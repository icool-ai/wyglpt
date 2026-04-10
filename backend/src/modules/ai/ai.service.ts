import { Injectable, NotFoundException } from "@nestjs/common";
import type { Response } from "express";
import { ApprovalsService } from "../approvals/approvals.service";
import { BillingService } from "../billing/billing.service";
import type { ListBillsQueryDto } from "../billing/dto/list-bills-query.dto";
import type { BillDto } from "../billing/billing.service";
import { AuditService } from "../audit/audit.service";
import { TicketsService } from "../tickets/tickets.service";
import { LlmService } from "../llm/llm.service";
import { OwnersService } from "../owners/owners.service";
import { DashboardService } from "../dashboard/dashboard.service";
import type { OwnerHouseholdDto } from "../owners/owners.service";
import type { OwnerListPageResult } from "../owners/owners.service";

export type CandidateAction = {
  actionType: "ticket_assign" | "ticket_close" | "billing_create" | "billing_collect" | "data_edit";
  reason: string;
  payload: Record<string, unknown>;
  requiresApproval: boolean;
};

/** 查库完成、尚未 JSON 润色 */
type AskOkPayload = {
  intent: string;
  analysis: unknown;
  baseAnswer: string;
  items: unknown[];
  total: number;
  page: number;
  pageSize: number;
  llmParseOk: boolean;
};

type AskBuildResult =
  | { kind: "terminal"; data: Record<string, unknown> }
  | { kind: "ok"; payload: AskOkPayload; reasoningParts: { intent?: string; narrative?: string } };

@Injectable()
export class AiService {
  constructor(
    private readonly approvals: ApprovalsService,
    private readonly tickets: TicketsService,
    private readonly billing: BillingService,
    private readonly owners: OwnersService,
    private readonly dashboard: DashboardService,
    private readonly audit: AuditService,
    private readonly llm: LlmService
  ) {}

  async generateTicketTriage(input: { ticketId: string; issueType: string }): Promise<CandidateAction> {
    const system = [
      "你是物业运维AI助手，专注工单智能分派。",
      "你必须输出严格JSON，不要输出任何解释性文字。",
      "JSON字段：actionType, reason, payload, requiresApproval。",
      "actionType只能为: ticket_assign",
      "payload必须包含：ticketId（来自输入）与assignee（责任班组名称，字符串）",
      "requiresApproval固定为true。"
    ].join("");

    const user = `输入: ticketId=${input.ticketId}, issueType=${input.issueType}`;

    const content = await this.llm.chatCompletion({
      system,
      user
    });

    const parsed = this.safeParseJson(content);
    return parsed as CandidateAction;
  }

  async summarizeTicket(input: { title: string; description: string }): Promise<{ summary: string; keyPoints: string[] }> {
    const system = [
      "你是物业运维AI助手，负责工单摘要。",
      "你必须输出严格JSON，不要输出任何解释性文字。",
      "JSON字段：summary（字符串）、keyPoints（字符串数组，3~6项）。"
    ].join("");

    const user = `工单标题: ${input.title}\n工单描述: ${input.description}`;
    const content = await this.llm.chatCompletion({ system, user });
    const parsed = this.safeParseJson(content);
    return parsed;
  }

  async explainKpi(input: { metric: string; current: number; previous: number }): Promise<{ metric: string; insight: string; recommendations: string[] }> {
    const system = [
      "你是物业运营分析AI助手，负责把看板指标转成洞察。",
      "你必须输出严格JSON，不要输出任何解释性文字。",
      "JSON字段：metric（字符串）、insight（字符串）、recommendations（字符串数组，2~5条）。"
    ].join("");

    const user = `指标: ${input.metric}\n当前值: ${input.current}\n上期值: ${input.previous}\n输出洞察时请结合“报修集中/派工效率/催缴回款/资源调度”等常见原因做合理推断。`;
    const content = await this.llm.chatCompletion({ system, user });
    const parsed = this.safeParseJson(content);
    return parsed;
  }

  async queryBillsByQuestion(
    input: { question: string; page?: number; pageSize?: number },
  ): Promise<{ summary: string; items: BillDto[]; total: number; page: number; pageSize: number }> {
    const fallbackPage = input.page ?? 1;
    const fallbackPageSize = input.pageSize ?? 10;

    const asIntInRange = (v: unknown, min: number, max: number, fallback: number) => {
      const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
      if (!Number.isFinite(n)) return fallback;
      const f = Math.floor(n);
      return Math.max(min, Math.min(max, f));
    };

    const asStr = (v: unknown) => (typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined);
    const asNumber = (v: unknown) => {
      const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
      return Number.isFinite(n) ? n : undefined;
    };

    const normalizeDate = (v: unknown) => {
      const s = asStr(v);
      if (!s) return undefined;
      // 尝试把 2026/3/1 => 2026-03-01
      const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
      if (!m) return s;
      const year = m[1];
      const month = String(Number(m[2])).padStart(2, "0");
      const day = String(Number(m[3])).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const normalizePay = (v: unknown) => {
      const p = asStr(v);
      if (!p) return undefined;
      const t = p.replace(/\s+/g, "");
      const map: Record<string, string> = {
        paid: "已支付",
        issued: "待支付",
        overdue: "逾期",
        partially_paid: "对账中",
        "已收": "已支付",
        "已回款": "已支付",
        "待收": "待支付",
        "未收": "待支付",
        "应收": "待支付",
        "待支付": "待支付",
        "对账中": "对账中",
        "部分支付": "对账中",
        "部分": "对账中",
        "逾期": "逾期",
        overduee: "逾期"
      };
      return map[t] || map[p] || map[t.toLowerCase()] || t;
    };

    const system = [
      "你是物业运维账单查询AI助手。",
      "你的任务是把用户自然语言问题转换成后端 GET /billing/bills/query 能理解的查询参数。",
      "必须输出严格JSON，不要输出任何解释性文字。",
      "只能包含以下字段：id,type,owner,periodStart,periodEnd,amountMin,amountMax,pay,page,pageSize。",
      "page/pageSize 用于分页：请务必输出整数；如果用户未指定则用 page=1,pageSize=10。",
      "pay只能是以下之一：已支付、待支付、对账中、逾期；如果问题未提及支付/对账状态则省略pay。",
      "periodStart/periodEnd必须是YYYY-MM-DD；如果无法推断到具体日期则省略该字段。",
      "amountMin/amountMax 必须为纯数字（不要带单位、逗号）。",
    ].join("");

    const user = `用户问题：${input.question}\n分页参数：page=${fallbackPage}, pageSize=${fallbackPageSize}\n请输出JSON。`;

    let parsed: any = {};
    let llmParseOk = false;
    try {
      const content = await this.llm.chatCompletion({ system, user });
      parsed = this.safeParseJson(content);
      llmParseOk = true;
    } catch {
      parsed = {};
      llmParseOk = false;
    }

    const normalizedQuery: Partial<ListBillsQueryDto> = {
      id: asStr(parsed?.id),
      type: asStr(parsed?.type),
      owner: asStr(parsed?.owner),
      periodStart: normalizeDate(parsed?.periodStart),
      periodEnd: normalizeDate(parsed?.periodEnd),
      amountMin: asNumber(parsed?.amountMin),
      amountMax: asNumber(parsed?.amountMax),
      pay: normalizePay(parsed?.pay),
      page: asIntInRange(parsed?.page, 1, 100, fallbackPage),
      pageSize: asIntInRange(parsed?.pageSize, 1, 100, fallbackPageSize),
    };

    // BillingService.search 里是：如果 query.pay 存在就把它当作中文状态映射后过滤
    // 因此这里保证 pay 至少是中文状态；否则可以省略让它走“不过滤支付状态”
    if (normalizedQuery.pay && !["已支付", "待支付", "对账中", "逾期"].includes(normalizedQuery.pay as string)) {
      normalizedQuery.pay = undefined;
    }

    const result = await this.billing.search(normalizedQuery as ListBillsQueryDto);
    const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

    const condParts: string[] = [];
    if (normalizedQuery.id) condParts.push(`单号包含“${normalizedQuery.id}”`);
    if (normalizedQuery.type) condParts.push(`类型包含“${normalizedQuery.type}”`);
    if (normalizedQuery.owner) condParts.push(`业主/房号包含“${normalizedQuery.owner}”`);
    if (normalizedQuery.periodStart) condParts.push(`账期开始含“${normalizedQuery.periodStart}”`);
    if (normalizedQuery.periodEnd) condParts.push(`账期结束含“${normalizedQuery.periodEnd}”`);
    if (normalizedQuery.amountMin != null) condParts.push(`金额>=${normalizedQuery.amountMin}`);
    if (normalizedQuery.amountMax != null) condParts.push(`金额<=${normalizedQuery.amountMax}`);
    if (normalizedQuery.pay) condParts.push(`支付/对账=${normalizedQuery.pay}`);

    const cond = condParts.length ? `（条件：${condParts.slice(0, 3).join("、")}${condParts.length > 3 ? "…" : ""}）` : "";
    const summary = `共 ${result.total} 条账单${cond}，当前页 ${result.page}/${totalPages}（展示 ${result.items.length} 条）。`;

    return { summary, items: result.items, total: result.total, page: result.page, pageSize: result.pageSize };
  }

  private async runNarrativeJson(
    question: string,
    analysis: any,
    baseAnswer: string,
    llmParseOk: boolean,
    useReasoner: boolean,
    showReasoning: boolean,
    reasoningParts: { intent?: string; narrative?: string }
  ): Promise<{
    answer: string;
    insights: string[];
    recommendations: string[];
    llmNarrativeUsed: boolean;
  }> {
    if (!llmParseOk) {
      return {
        answer: baseAnswer + "（LLM不可用，仅供参考）",
        insights: [],
        recommendations: [],
        llmNarrativeUsed: false
      };
    }

    const narrativeSystem = [
      "你是物业运维数据分析助手。",
      "你收到结构化统计分析后，需要用中文生成更自然的回答。",
      "必须输出严格JSON，不要输出解释性文字。",
      "JSON字段：answer（字符串，1~3句）、insights（字符串数组，最多3条）、recommendations（字符串数组，最多3条）。",
    ].join("");

    const narrativeUser = `用户问题：${question}\n结构化分析（JSON）：${JSON.stringify(analysis)}`;

    try {
      let parsed: any = {};
      if (useReasoner) {
        const r = await this.llm.chatCompletionWithReasoning({
          system: narrativeSystem,
          user: narrativeUser,
          model: "deepseek-reasoner",
          temperature: 0.2,
        });
        parsed = this.safeParseJson(r.content);
        if (showReasoning && r.reasoningContent) reasoningParts.narrative = r.reasoningContent;
      } else {
        const content = await this.llm.chatCompletion({
          system: narrativeSystem,
          user: narrativeUser,
          temperature: 0.2,
        });
        parsed = this.safeParseJson(content);
      }
      return {
        answer: typeof parsed?.answer === "string" && parsed.answer.trim().length ? parsed.answer : baseAnswer,
        insights: Array.isArray(parsed?.insights) ? parsed.insights.map(String).slice(0, 3) : [],
        recommendations: Array.isArray(parsed?.recommendations) ? parsed.recommendations.map(String).slice(0, 3) : [],
        llmNarrativeUsed: true
      };
    } catch {
      return {
        answer: baseAnswer + "（LLM生成洞察失败，仅供参考）",
        insights: [],
        recommendations: [],
        llmNarrativeUsed: false
      };
    }
  }

  /**
   * 全局问答入口：
   * - LLM 输出 {intent, query, page, pageSize}
   * - 后端根据 intent 选择不同 service 查询并返回 {answer, intent, items, total, page, pageSize}
   *
   * 这样就不会出现“无论怎么问都只返回同一份账单”的问题。
   */
  private async buildAskData(input: {
    question: string;
    page?: number;
    pageSize?: number;
    thinking?: boolean;
    showReasoning?: boolean;
  }): Promise<AskBuildResult> {
    const useReasoner = Boolean(input.thinking);
    const showReasoning = Boolean(input.showReasoning);
    const reasoningParts: { intent?: string; narrative?: string } = {};

    const fallbackPage = input.page ?? 1;
    const fallbackPageSize = input.pageSize ?? 10;

    const asIntInRange = (v: unknown, min: number, max: number, fallback: number) => {
      const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
      if (!Number.isFinite(n)) return fallback;
      const f = Math.floor(n);
      return Math.max(min, Math.min(max, f));
    };

    const asStr = (v: unknown) => (typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined);

    const normalizeDate = (v: unknown) => {
      const s = asStr(v);
      if (!s) return undefined;
      const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
      if (!m) return s;
      const year = m[1];
      const month = String(Number(m[2])).padStart(2, "0");
      const day = String(Number(m[3])).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const normalizePay = (v: unknown) => {
      const p = asStr(v);
      if (!p) return undefined;
      const t = p.replace(/\s+/g, "");
      const map: Record<string, string> = {
        paid: "已支付",
        issued: "待支付",
        overdue: "逾期",
        partially_paid: "对账中",
        "已支付": "已支付",
        "待支付": "待支付",
        "对账中": "对账中",
        "逾期": "逾期"
      };
      return map[t] || map[t.toLowerCase()];
    };

    const normalizeTicketStatus = (v: unknown) => {
      const s = asStr(v);
      if (!s) return undefined;
      const t = s.replace(/\s+/g, "");
      const map: Record<string, string> = {
        new: "new",
        assigned: "assigned",
        in_progress: "in_progress",
        done: "done",
        closed: "closed",
        // 中文
        "新建": "new",
        "待处理": "new",
        "未分配": "new",
        "待指派": "new",
        "已指派": "assigned",
        "指派中": "in_progress",
        "处理中": "in_progress",
        "进行中": "in_progress",
        "已完成": "done",
        "完成": "done",
        "已解决": "done",
        "关闭": "closed",
        "已关闭": "closed",
      };
      return map[t] || map[t.toLowerCase()];
    };

    const normalizeApprovalStatus = (v: unknown) => {
      const s = asStr(v);
      if (!s) return undefined;
      const t = s.replace(/\s+/g, "");
      const map: Record<string, string> = {
        pending: "pending",
        approved: "approved",
        rejected: "rejected",
        // 中文
        "待处理": "pending",
        "已通过": "approved",
        "已审批": "approved",
        "已批准": "approved",
        "已拒绝": "rejected",
        "驳回": "rejected",
      };
      return map[t] || map[t.toLowerCase()];
    };

    const normalizeApprovalActionType = (v: unknown) => {
      const s = asStr(v);
      if (!s) return undefined;
      const t = s.replace(/\s+/g, "");
      const map: Record<string, string> = {
        billing_create: "billing_create",
        billing_collect: "billing_collect",
        billing_batch_create: "billing_batch_create",
        ticket_assign: "ticket_assign",
        ticket_close: "ticket_close",
        data_edit: "data_edit",
        // 中文（尽量覆盖）
        "账单创建": "billing_create",
        "创建账单": "billing_create",
        "收缴账单": "billing_collect",
        "收缴": "billing_collect",
        "批量创建": "billing_batch_create",
        "批量创建账单": "billing_batch_create",
        "工单指派": "ticket_assign",
        "指派": "ticket_assign",
        "关闭工单": "ticket_close",
        "关闭": "ticket_close",
      };
      return map[t] || map[t.toLowerCase()];
    };

    const heuristicIntent = () => {
      const q = input.question ?? "";
      const t = q.toLowerCase();
      const has = (re: RegExp) => re.test(q) || re.test(t);
      if (has(/账单|账务|billing/)) return "billing";
      if (has(/工单|ticket|报修|派工/)) return "tickets";
      if (has(/业主|房号|房间|owner|户|电话/)) return "owners";
      if (has(/审批|approve|审核|reject/)) return "approvals";
      if (has(/看板|指标|kpi|收缴率|工单关闭率/)) return "dashboard_ai_metrics";
      // 如果完全匹配不上业务领域，避免“硬给看板概览”导致机械感
      return "unknown";
    };

    const system = [
      "你是物业运维综合问答助手。",
      "你要把用户问题转换成后端可以执行的“查询意图 + 查询参数”。",
      "必须输出严格JSON，不要输出任何解释性文字。",
      "JSON字段：intent, query, page, pageSize。",
      "intent只能为：billing,tickets,owners,approvals,dashboard_overview,dashboard_ai_metrics,unknown。",
      "page/pageSize只输出整数；如果用户没说则 page=1,pageSize=10。",
      "query根据intent决定：",
      "billing：id,type,owner,periodStart,periodEnd,amountMin,amountMax,pay。",
      "tickets：q,status。",
      "owners：q。",
      "approvals：q,status,actionType。",
      "dashboard_*：query可省略。",
      "不要输出多余字段。",
    ].join("");

    const user = `用户问题：${input.question}`;

    let parsed: any = {};
    let llmParseOk = false;
    try {
      if (useReasoner) {
        const r = await this.llm.chatCompletionWithReasoning({ system, user, model: "deepseek-reasoner" });
        parsed = this.safeParseJson(r.content);
        if (showReasoning && r.reasoningContent) reasoningParts.intent = r.reasoningContent;
      } else {
        const content = await this.llm.chatCompletion({ system, user });
        parsed = this.safeParseJson(content);
      }
      llmParseOk = true;
    } catch {
      parsed = {};
    }

    const intent = (parsed?.intent as string) || heuristicIntent();
    const page = asIntInRange(parsed?.page ?? fallbackPage, 1, 100, fallbackPage);
    const pageSize = asIntInRange(parsed?.pageSize ?? fallbackPageSize, 1, 100, fallbackPageSize);
    const query = parsed?.query ?? {};

    if (intent === "unknown") {
      const help =
        "你可以问：有哪些账单（待支付/已支付/逾期）？有哪些工单未关闭？查询哪些业主？看板概览/看板指标。";
      return {
        kind: "terminal",
        data: {
          answer: llmParseOk ? "我没能明确识别你的业务意图，暂时无法回答当前问题。" + help : "LLM 意图识别不可用，暂时无法回答当前问题。" + help,
          ...(showReasoning
            ? {
                reasoning: [reasoningParts.intent ? `【意图解析】\n${reasoningParts.intent}` : "", reasoningParts.narrative ? `【回答生成】\n${reasoningParts.narrative}` : ""]
                  .filter(Boolean)
                  .join("\n\n") || undefined
              }
            : {}),
          intent,
          items: [],
          total: 0,
          page: 1,
          pageSize: 0,
          analysis: null,
          llmUsed: llmParseOk,
          insights: [],
          recommendations: [],
          llmNarrativeUsed: false,
        },
      };
    }

    if (intent === "billing") {
      const result = await this.billing.search({
        id: asStr(query?.id),
        type: asStr(query?.type),
        owner: asStr(query?.owner),
        periodStart: normalizeDate(query?.periodStart),
        periodEnd: normalizeDate(query?.periodEnd),
        amountMin: typeof query?.amountMin === "number" ? query.amountMin : undefined,
        amountMax: typeof query?.amountMax === "number" ? query.amountMax : undefined,
        pay: normalizePay(query?.pay),
        page,
        pageSize,
      } as ListBillsQueryDto);

      const payCounts = result.items.reduce<Record<string, number>>((acc, x) => {
        const k = x.pay || "未知";
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {});
      const typeCounts = result.items.reduce<Record<string, number>>((acc, x) => {
        const k = x.type || "未知";
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {});
      const amountSum = result.items.reduce((s, x) => s + Number(x.amount ?? 0), 0);
      const amountMinOnPage = result.items.length ? Math.min(...result.items.map((x) => Number(x.amount ?? 0))) : null;
      const amountMaxOnPage = result.items.length ? Math.max(...result.items.map((x) => Number(x.amount ?? 0))) : null;

      const topPay = Object.entries(payCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([k, v]) => `${k}(${v})`);
      const topTypes = Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, v]) => `${k}(${v})`);

      const baseAnswer =
        `账单查询完成：共 ${result.total} 条，当前第 ${result.page} 页（展示 ${result.items.length} 条）。` +
        (topPay.length ? ` 主要状态：${topPay.join("、")}。` : "") +
        (topTypes.length ? ` 主要类型：${topTypes.join("、")}。` : "") +
        ` 本页金额合计 ${amountSum.toFixed(2)} 元。`;

      const analysis = {
        totalOnPage: result.items.length,
        amountSumOnPage: Number(amountSum.toFixed(2)),
        amountMinOnPage,
        amountMaxOnPage,
        payCounts,
        typeCounts,
      };

      return {
        kind: "ok" as const,
        payload: {
          intent,
          analysis,
          baseAnswer,
          items: result.items,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          llmParseOk,
        },
        reasoningParts,
      };
    }

    if (intent === "tickets") {
      const all = await this.tickets.list();
      const q = asStr(query?.q);
      const status = normalizeTicketStatus(query?.status);

      let filtered = all;
      if (q) {
        const needle = q.toLowerCase();
        filtered = filtered.filter((t) => {
          const id = String(t.id ?? "").toLowerCase();
          const title = String(t.title ?? "").toLowerCase();
          const desc = String(t.description ?? "").toLowerCase();
          return id.includes(needle) || title.includes(needle) || desc.includes(needle);
        });
      }
      if (status) filtered = filtered.filter((t) => t.status === status);

      const total = filtered.length;
      const start = (page - 1) * pageSize;
      const items = filtered.slice(start, start + pageSize);

      const statusCounts = filtered.reduce<Record<string, number>>((acc, x) => {
        const k = x.status || "未知";
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {});
      const topStatus = Object.entries(statusCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, v]) => `${k}(${v})`);

      const baseAnswer =
        `工单查询完成：共 ${total} 条，当前第 ${page} 页（展示 ${items.length} 条）。` +
        (topStatus.length ? ` 主要状态：${topStatus.join("、")}。` : "");

      const analysis = {
        totalOnFiltered: total,
        statusCounts,
      };

      return {
        kind: "ok" as const,
        payload: {
          intent,
          analysis,
          baseAnswer,
          items,
          total,
          page,
          pageSize,
          llmParseOk,
        },
        reasoningParts,
      };
    }

    if (intent === "owners") {
      const result: OwnerListPageResult = await this.owners.list({ q: asStr(query?.q), page, pageSize } as any);
      const tagCounts = result.items.reduce<Record<string, number>>((acc, x) => {
        for (const t of x.tags ?? []) {
          const k = t || "未知";
          acc[k] = (acc[k] ?? 0) + 1;
        }
        return acc;
      }, {});
      const memberCountSum = result.items.reduce((s, x) => s + Number(x.memberCount ?? 0), 0);
      const topTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, v]) => `${k}(${v})`);
      const baseAnswer =
        `业主查询完成：共 ${result.total} 条，当前第 ${result.page} 页（展示 ${result.items.length} 条）。` +
        (topTags.length ? ` 主要标签：${topTags.join("、")}。` : "") +
        ` 本页成员数合计 ${memberCountSum} 人。`;

      const analysis = {
        totalOnPage: result.items.length,
        memberCountSumOnPage: memberCountSum,
        tagCounts,
      };

      return {
        kind: "ok" as const,
        payload: {
          intent,
          analysis,
          baseAnswer,
          items: result.items,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          llmParseOk,
        },
        reasoningParts,
      };
    }

    if (intent === "approvals") {
      const all = await this.approvals.list({
        q: asStr(query?.q),
        status: normalizeApprovalStatus(query?.status),
        actionType: normalizeApprovalActionType(query?.actionType),
      } as any);

      const total = all.length;
      const start = (page - 1) * pageSize;
      const items = all.slice(start, start + pageSize);

      const statusCounts = all.reduce<Record<string, number>>((acc, x) => {
        const k = x.status || "未知";
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {});
      const actionTypeCounts = all.reduce<Record<string, number>>((acc, x) => {
        const k = x.actionType || "未知";
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {});
      const topStatus = Object.entries(statusCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([k, v]) => `${k}(${v})`);
      const topActionTypes = Object.entries(actionTypeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, v]) => `${k}(${v})`);

      const baseAnswer =
        `审批记录查询：共 ${total} 条，当前第 ${page} 页（展示 ${items.length} 条）。` +
        (topStatus.length ? ` 主要状态：${topStatus.join("、")}。` : "") +
        (topActionTypes.length ? ` 主要类型：${topActionTypes.join("、")}。` : "");

      const analysis = {
        totalOnFiltered: total,
        statusCounts,
        actionTypeCounts,
      };

      return {
        kind: "ok" as const,
        payload: {
          intent,
          analysis,
          baseAnswer,
          items,
          total,
          page,
          pageSize,
          llmParseOk,
        },
        reasoningParts,
      };
    }

    if (intent === "dashboard_overview") {
      const overview = await this.dashboard.getOverview();
      const baseAnswer =
        `看板概览：工单 ${overview.ticketCount} 条，账单 ${overview.billCount} 条；` +
        `收缴率 ${overview.paymentRate}，应收合计 ${overview.receivableAmount} 元。`;

      const analysis = { overview };
      return {
        kind: "ok" as const,
        payload: {
          intent,
          analysis,
          baseAnswer,
          items: [overview],
          total: 1,
          page: 1,
          pageSize: 1,
          llmParseOk,
        },
        reasoningParts,
      };
    }

    if (intent === "dashboard_ai_metrics") {
      const metrics = await this.dashboard.aiMetrics();
      const baseAnswer = `看板指标（AI Metrics）：${metrics.map((m: any) => `${m.metric}=${m.current}`).join("，")}。`;
      const analysis = { metrics };
      return {
        kind: "ok" as const,
        payload: {
          intent,
          analysis,
          baseAnswer,
          items: metrics,
          total: metrics.length,
          page: 1,
          pageSize: Math.max(1, metrics.length),
          llmParseOk,
        },
        reasoningParts,
      };
    }

    // 兜底：LLM 可能输出了未知 intent
    return {
      kind: "terminal",
      data: {
        answer: llmParseOk
          ? "我没能明确你的业务意图，暂时无法回答。你可以问：账单/工单/业主/审批/看板。"
          : "LLM 当前不可用，暂时无法回答具体意图。你可以问：账单/工单/业主/审批/看板。",
        ...(showReasoning
          ? {
              reasoning: [reasoningParts.intent ? `【意图解析】\n${reasoningParts.intent}` : "", reasoningParts.narrative ? `【回答生成】\n${reasoningParts.narrative}` : ""]
                .filter(Boolean)
                .join("\n\n") || undefined
            }
          : {}),
        intent: "unknown",
        items: [],
        total: 0,
        page: 1,
        pageSize: 0,
        analysis: null,
        llmUsed: llmParseOk,
        insights: [],
        recommendations: [],
        llmNarrativeUsed: false,
      },
    };
  }

  async askQuestion(input: {
    question: string;
    page?: number;
    pageSize?: number;
    thinking?: boolean;
    showReasoning?: boolean;
  }): Promise<any> {
    const useReasoner = Boolean(input.thinking);
    const showReasoning = Boolean(input.showReasoning);
    const built = await this.buildAskData(input);
    if (built.kind === "terminal") return built.data;

    const p = built.payload;
    const narrative = await this.runNarrativeJson(
      input.question,
      p.analysis,
      p.baseAnswer,
      p.llmParseOk,
      useReasoner,
      showReasoning,
      built.reasoningParts
    );
    const reasoningStr =
      showReasoning
        ? [built.reasoningParts.intent ? `【意图解析】\n${built.reasoningParts.intent}` : "", built.reasoningParts.narrative ? `【回答生成】\n${built.reasoningParts.narrative}` : ""]
            .filter(Boolean)
            .join("\n\n") || undefined
        : undefined;

    return {
      answer: narrative.answer,
      insights: narrative.insights,
      recommendations: narrative.recommendations,
      llmNarrativeUsed: narrative.llmNarrativeUsed,
      ...(showReasoning && reasoningStr ? { reasoning: reasoningStr } : {}),
      intent: p.intent,
      items: p.items,
      total: p.total,
      page: p.page,
      pageSize: p.pageSize,
      analysis: p.analysis,
      llmUsed: p.llmParseOk,
    };
  }

  /**
   * 查库完成后，先 SSE 推送 meta（含真实 items/analysis），再流式输出润色正文；最后可选推送 insights/recommendations。
   */
  async streamAskQuestion(
    res: Response,
    input: { question: string; page?: number; pageSize?: number; thinking?: boolean; showReasoning?: boolean }
  ): Promise<void> {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const useReasoner = Boolean(input.thinking);
    const showReasoning = Boolean(input.showReasoning);

    try {
      const built = await this.buildAskData(input);
      if (built.kind === "terminal") {
        res.write(`data: ${JSON.stringify({ event: "meta", terminal: true, ...built.data })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      const p = built.payload;
      const intentReasoning =
        showReasoning && built.reasoningParts.intent ? `【意图解析】\n${built.reasoningParts.intent}` : undefined;

      res.write(
        `data: ${JSON.stringify({
          event: "meta",
          terminal: false,
          intent: p.intent,
          items: p.items,
          total: p.total,
          page: p.page,
          pageSize: p.pageSize,
          analysis: p.analysis,
          baseAnswer: p.baseAnswer,
          llmUsed: p.llmParseOk,
          reasoning: intentReasoning,
        })}\n\n`
      );

      if (!p.llmParseOk) {
        res.write(`data: ${JSON.stringify({ kind: "content", text: p.baseAnswer + "（LLM不可用）" })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      const streamSystem = [
        "你是物业运维数据分析助手。",
        "下面「统计摘要」和「结构化分析」来自本平台真实数据库查询结果，你必须严格依据其中的数字与条数回答，禁止编造。",
        "请用自然、简洁的中文写一段给用户看的说明（约 2～6 句），只输出正文，不要使用 Markdown 标题、不要输出 JSON。",
      ].join("");

      const streamUser = `用户问题：${input.question}\n统计摘要：${p.baseAnswer}\n结构化分析 JSON：${JSON.stringify(p.analysis)}`;

      for await (const chunk of this.llm.streamChatCompletion({
        system: streamSystem,
        user: streamUser,
        model: useReasoner ? "deepseek-reasoner" : undefined,
      })) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }

      try {
        const extraJson = await this.llm.chatCompletion({
          system: [
            "你是物业运维助手。根据结构化分析，输出严格 JSON，不要其他文字。",
            'JSON 格式：{"insights":["最多3条"],"recommendations":["最多3条"]}，中文。',
          ].join(""),
          user: `用户问题：${input.question}\n结构化分析：${JSON.stringify(p.analysis)}`,
          temperature: 0.2,
        });
        const ex = this.safeParseJson(extraJson) as { insights?: unknown[]; recommendations?: unknown[] };
        res.write(
          `data: ${JSON.stringify({
            event: "extras",
            insights: Array.isArray(ex?.insights) ? ex.insights.map(String).slice(0, 3) : [],
            recommendations: Array.isArray(ex?.recommendations) ? ex.recommendations.map(String).slice(0, 3) : [],
          })}\n\n`
        );
      } catch {
        /* 忽略 extras 失败 */
      }

      res.write("data: [DONE]\n\n");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.write(`data: ${JSON.stringify({ event: "error", message: msg })}\n\n`);
    }
    res.end();
  }

  async requestExecution(candidate: CandidateAction) {
    const approval = await this.approvals.create(candidate.actionType, candidate.payload);
    await this.audit.recordStrictAudit({
      actor: "ai",
      action: "ai_candidate_created",
      entityType: "approval",
      entityId: approval.id,
      reason: candidate.reason,
      maskedInput: this.mask(candidate.payload)
    });
    return approval;
  }

  async executeApproved(approvalId: string) {
    const rows = await this.approvals.list();
    const approval = rows.find((x) => x.id === approvalId);
    if (!approval) throw new NotFoundException("Approval not found");
    if (approval.status !== "approved") throw new NotFoundException("Approval is not approved");

    let result: unknown = null;
    result = await this.tickets.executeApproved(approval.actionType, approval.payload as Record<string, unknown>);
    if (!result) {
      result = await this.billing.executeApproved(approval.actionType, approval.payload as Record<string, unknown>);
    }
    if (!result) throw new NotFoundException("No executor for this action");

    await this.audit.recordStrictAudit({
      actor: "ai_executor",
      action: "approved_action_executed",
      entityType: approval.actionType,
      entityId: approval.id,
      diff: result as Record<string, unknown>
    });
    return result;
  }

  private mask(input: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(input)) {
      const value = input[key];
      out[key] = typeof value === "string" && value.length > 2 ? `${value.slice(0, 1)}***` : value;
    }
    return out;
  }

  private safeParseJson(content: string): any {
    // 兼容模型返回“包裹文本 + JSON”两种情况
    try {
      return JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("LLM output is not valid JSON");
      return JSON.parse(match[0]);
    }
  }
}
