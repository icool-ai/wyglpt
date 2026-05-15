import { Injectable } from "@nestjs/common";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod/v3";
import { BillingService } from "../billing/billing.service";
import { TicketsService } from "../tickets/tickets.service";
import { ApprovalsService } from "../approvals/approvals.service";
import { OwnersService } from "../owners/owners.service";
import { DashboardService } from "../dashboard/dashboard.service";
import type { ListBillsQueryDto } from "../billing/dto/list-bills-query.dto";
import { LlmService } from "../llm/llm.service";

type StreamChunk = { kind: "reasoning" | "content"; text: string };
type StreamMeta = { event: "meta"; model: string; maxToolRounds: number };
export type DeepAgentsStreamEvent = StreamChunk | StreamMeta;

@Injectable()
export class DeepAgentsService {
  constructor(
    private readonly billing: BillingService,
    private readonly tickets: TicketsService,
    private readonly approvals: ApprovalsService,
    private readonly owners: OwnersService,
    private readonly dashboard: DashboardService,
    private readonly llm: LlmService
  ) {}

  private readonly capabilityTool = tool(
    async (input) => {
      const data = input as { topic?: string } | undefined;
      const topic = (data?.topic || "平台能力").trim();
      return [
        `【${topic}】最小示例工具返回：`,
        "1) 当前为 DeepAgents 最小链路，支持中文对话与流式输出；",
        "2) 可扩展接入账单/工单/审批工具；",
        "3) 本工具仅用于验证 LangChain 工具调用链路是否可用。"
      ].join("\n");
    },
    {
      name: "get_platform_capability",
      description: "当用户询问系统/平台能力、支持范围、可做什么时调用",
      schema: z.object({
        topic: z.string().describe("用户关注的能力主题；无特定主题可传“平台能力”")
      }) as any
    }
  );

  private readonly billingQueryTool = tool(
    async (input) => {
      const data = (input ?? {}) as {
        owner?: string;
        type?: string;
        pay?: string;
        page?: number;
        pageSize?: number;
      };
      const query: ListBillsQueryDto = {
        owner: typeof data.owner === "string" ? data.owner.trim() || undefined : undefined,
        type: typeof data.type === "string" ? data.type.trim() || undefined : undefined,
        pay: this.normalizePay(data.pay),
        page: this.asPage(data.page, 1),
        pageSize: this.asPage(data.pageSize, 10)
      };
      const result = await this.billing.search(query);
      return JSON.stringify({
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        items: result.items.slice(0, 10)
      });
    },
    {
      name: "query_bills",
      description: "查询账单列表，支持业主、类型、支付状态、分页条件",
      schema: z.object({
        owner: z.string().describe("业主名或房号关键词；不筛选可传空字符串"),
        type: z.string().describe("账单类型关键词；不筛选可传空字符串"),
        pay: z.string().describe("支付状态：已支付|待支付|对账中|逾期；不筛选可传空字符串"),
        page: z.number().int().min(1).max(100).describe("页码，默认传 1"),
        pageSize: z.number().int().min(1).max(100).describe("每页条数，默认传 10")
      }) as any
    }
  );

  private readonly ticketsQueryTool = tool(
    async (input) => {
      const data = (input ?? {}) as { q?: string; status?: string; page?: number; pageSize?: number };
      const all = await this.tickets.list();
      const q = typeof data.q === "string" ? data.q.trim().toLowerCase() : "";
      const status = this.normalizeTicketStatus(data.status);

      let filtered = all;
      if (q) {
        filtered = filtered.filter((t) =>
          [t.id, t.title, t.description, t.assignee ?? ""].some((x) => String(x).toLowerCase().includes(q))
        );
      }
      if (status) {
        filtered = filtered.filter((t) => t.status === status);
      }
      const page = this.asPage(data.page, 1);
      const pageSize = this.asPage(data.pageSize, 10);
      const start = (page - 1) * pageSize;
      return JSON.stringify({
        total: filtered.length,
        page,
        pageSize,
        items: filtered.slice(start, start + pageSize)
      });
    },
    {
      name: "query_tickets",
      description: "查询工单列表，支持关键词和状态过滤",
      schema: z.object({
        q: z.string().describe("工单关键词（标题/描述/处理人）；不筛选可传空字符串"),
        status: z.string().describe("状态：new|assigned|in_progress|done|closed 或中文；不筛选可传空字符串"),
        page: z.number().int().min(1).max(100).describe("页码，默认传 1"),
        pageSize: z.number().int().min(1).max(100).describe("每页条数，默认传 10")
      }) as any
    }
  );

  private readonly approvalsQueryTool = tool(
    async (input) => {
      const data = (input ?? {}) as { q?: string; status?: string; actionType?: string; page?: number; pageSize?: number };
      const rows = await this.approvals.list({
        q: typeof data.q === "string" ? data.q.trim() || undefined : undefined,
        status: this.normalizeApprovalStatus(data.status),
        actionType: this.normalizeApprovalActionType(data.actionType)
      });
      const page = this.asPage(data.page, 1);
      const pageSize = this.asPage(data.pageSize, 10);
      const start = (page - 1) * pageSize;
      return JSON.stringify({
        total: rows.length,
        page,
        pageSize,
        items: rows.slice(start, start + pageSize)
      });
    },
    {
      name: "query_approvals",
      description: "查询审批列表，支持关键词、状态、动作类型过滤",
      schema: z.object({
        q: z.string().describe("关键词；不筛选可传空字符串"),
        status: z.string().describe("状态：pending|approved|rejected 或中文；不筛选可传空字符串"),
        actionType: z.string().describe("动作类型，如 billing_create、ticket_assign；不筛选可传空字符串"),
        page: z.number().int().min(1).max(100).describe("页码，默认传 1"),
        pageSize: z.number().int().min(1).max(100).describe("每页条数，默认传 10")
      }) as any
    }
  );

  private readonly ownersQueryTool = tool(
    async (input) => {
      const data = (input ?? {}) as { q?: string; page?: number; pageSize?: number };
      const page = this.asPage(data.page, 1);
      const pageSize = this.asPage(data.pageSize, 10);
      const rows = await this.owners.list({
        q: typeof data.q === "string" ? data.q.trim() || undefined : undefined,
        page,
        pageSize
      });
      return JSON.stringify(rows);
    },
    {
      name: "query_owners",
      description: "查询业主户信息，支持房号/业主姓名/电话关键词",
      schema: z.object({
        q: z.string().describe("关键词；不筛选可传空字符串"),
        page: z.number().int().min(1).max(100).describe("页码，默认传 1"),
        pageSize: z.number().int().min(1).max(100).describe("每页条数，默认传 10")
      }) as any
    }
  );

  private readonly dashboardOverviewTool = tool(
    async () => {
      const overview = await this.dashboard.getOverview();
      const metrics = await this.dashboard.aiMetrics();
      return JSON.stringify({ overview, metrics });
    },
    {
      name: "get_dashboard_overview",
      description: "获取看板概览与关键指标",
      schema: z.object({}) as any
    }
  );

  async *streamChat(input: { question: string; thinking?: boolean }): AsyncGenerator<DeepAgentsStreamEvent> {
    const llm = this.createModel(input.thinking);
    const tools = [
      this.capabilityTool,
      this.billingQueryTool,
      this.ticketsQueryTool,
      this.approvalsQueryTool,
      this.ownersQueryTool,
      this.dashboardOverviewTool
    ];
    const llmWithTools = llm.bindTools(tools);
    const maxToolRounds = Number(process.env.DEEPAGENTS_MAX_TOOL_ROUNDS || 4);
    const schemaSummary = tools.map((x) => {
      const s = (x as unknown as { schema?: unknown }).schema;
      const d = s && typeof s === "object" ? (s as { _def?: { typeName?: unknown } })._def : undefined;
      return {
        name: x.name,
        hasSchema: Boolean(s),
        schemaCtor: s && typeof s === "object" ? (s as { constructor?: { name?: string } }).constructor?.name || "" : typeof s,
        schemaTypeName: d?.typeName ?? null
      };
    });
    // #region agent log
    fetch('http://127.0.0.1:7440/ingest/32c6740f-0b28-44ac-9021-1be15ccf10a9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e152f2'},body:JSON.stringify({sessionId:'e152f2',runId:'deepagents-schema-debug',hypothesisId:'H1',location:'backend/src/modules/ai/deepagents.service.ts:streamChat:init',message:'deepagents stream initialized with tools',data:{toolCount:tools.length,toolNames:tools.map((x)=>x.name),schemaSummary,maxToolRounds,thinking:Boolean(input.thinking),model:this.resolveModelName()},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const llmWithToolsObj = llmWithTools as unknown as {
      kwargs?: { tools?: Array<{ function?: { name?: string; parameters?: unknown } }> };
      bound?: { tools?: Array<{ function?: { name?: string; parameters?: unknown } }> };
    };
    const boundTools = llmWithToolsObj.kwargs?.tools ?? llmWithToolsObj.bound?.tools ?? [];
    const toolParamSummary = Array.isArray(boundTools)
      ? boundTools.map((t) => {
          const p = t?.function?.parameters as { type?: unknown; properties?: unknown } | undefined;
          const propCount = p?.properties && typeof p.properties === "object" ? Object.keys(p.properties as Record<string, unknown>).length : null;
          return {
            name: t?.function?.name ?? "",
            paramType: p?.type ?? null,
            propCount
          };
        })
      : [];
    // #region agent log
    fetch('http://127.0.0.1:7440/ingest/32c6740f-0b28-44ac-9021-1be15ccf10a9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e152f2'},body:JSON.stringify({sessionId:'e152f2',runId:'deepagents-schema-debug',hypothesisId:'H5',location:'backend/src/modules/ai/deepagents.service.ts:streamChat:boundToolsSnapshot',message:'snapshot of bound tools payload',data:{boundToolCount:Array.isArray(boundTools)?boundTools.length:-1,toolParamSummary},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    const system = [
      "你是物业运维智能助手（LangChain DeepAgents 最小实现）。",
      "优先简洁回答，信息不确定时明确说明。",
      "当用户询问数据时，应优先调用工具获取真实结果再回答。",
      "可用工具：get_platform_capability、query_bills、query_tickets、query_approvals、query_owners、get_dashboard_overview。"
    ].join("");

    yield { event: "meta", model: this.resolveModelName(), maxToolRounds };
    const toolMap = new Map(tools.map((x) => [x.name, x]));
    const conversation: Array<SystemMessage | HumanMessage | AIMessage | ToolMessage> = [
      new SystemMessage(system),
      new HumanMessage(input.question)
    ];

    if (input.thinking) {
      yield* this.streamChatWithReasonerFinalAnswer(llmWithTools, conversation, toolMap, maxToolRounds);
      return;
    }

    for (let round = 0; round < maxToolRounds; round++) {
      // #region agent log
      fetch('http://127.0.0.1:7440/ingest/32c6740f-0b28-44ac-9021-1be15ccf10a9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e152f2'},body:JSON.stringify({sessionId:'e152f2',runId:'deepagents-schema-debug',hypothesisId:'H2',location:'backend/src/modules/ai/deepagents.service.ts:streamChat:beforeInvoke',message:'about to invoke llmWithTools',data:{round,conversationLength:conversation.length,lastMessageType:conversation.length?conversation[conversation.length-1]?.constructor?.name:''},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      let acc: AIMessageChunk | undefined;
      try {
        const stream = await llmWithTools.stream(conversation);
        for await (const raw of stream) {
          const chunk = raw as AIMessageChunk;
          acc = acc ? acc.concat(chunk) : chunk;
          const cDelta = this.extractText(chunk.content);
          if (cDelta) yield { kind: "content", text: cDelta };
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        // #region agent log
        fetch('http://127.0.0.1:7440/ingest/32c6740f-0b28-44ac-9021-1be15ccf10a9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e152f2'},body:JSON.stringify({sessionId:'e152f2',runId:'deepagents-schema-debug',hypothesisId:'H3',location:'backend/src/modules/ai/deepagents.service.ts:streamChat:invokeError',message:'llmWithTools invoke failed',data:{round,conversationLength:conversation.length,errorMessage:msg.slice(0,300),toolNames:tools.map((x)=>x.name)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        throw e;
      }
      if (!acc) {
        yield { kind: "content", text: "（模型无输出）" };
        return;
      }

      const ai = this.chunkToAiMessage(acc);
      conversation.push(ai);

      if (!this.hasToolCalls(ai)) {
        return;
      }

      for (const call of ai.tool_calls) {
        const matched = toolMap.get(call.name);
        const args = this.safeToolArgs(call.args);
        if (!matched) {
          conversation.push(
            new ToolMessage({
              tool_call_id: call.id || call.name,
              content: "未知工具"
            })
          );
          continue;
        }
        try {
          const toolResult = await matched.invoke(call.args ?? {});
          conversation.push(
            new ToolMessage({
              tool_call_id: call.id || call.name,
              content: typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult)
            })
          );
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          conversation.push(
            new ToolMessage({
              tool_call_id: call.id || call.name,
              content: `工具调用失败：${msg}`
            })
          );
        }
      }
    }

    yield { kind: "content", text: "已达到最大工具调用轮次，请缩小问题范围后重试。" };
  }

  /**
   * deepseek-reasoner 不支持 Function Calling，因此工具轮仍用 deepseek-chat invoke；
   * 最后一轮无 tool_calls 时，用直连 SSE 流式调用 reasoner，才能拿到 reasoning_content。
   */
  private async *streamChatWithReasonerFinalAnswer(
    llmWithTools: { invoke: (input: BaseMessage[]) => Promise<AIMessage> },
    conversation: Array<SystemMessage | HumanMessage | AIMessage | ToolMessage>,
    toolMap: Map<string, { invoke: (input?: unknown) => Promise<unknown> }>,
    maxToolRounds: number
  ): AsyncGenerator<DeepAgentsStreamEvent> {
    const reasonerModel = process.env.DEEPAGENTS_REASONER_MODEL?.trim() || "deepseek-reasoner";

    for (let round = 0; round < maxToolRounds; round++) {
      let ai: AIMessage;
      try {
        ai = await llmWithTools.invoke(conversation);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        fetch('http://127.0.0.1:7440/ingest/32c6740f-0b28-44ac-9021-1be15ccf10a9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e152f2'},body:JSON.stringify({sessionId:'e152f2',runId:'deepagents-schema-debug',hypothesisId:'H3',location:'backend/src/modules/ai/deepagents.service.ts:streamChatWithReasoner:invokeError',message:'llmWithTools invoke failed',data:{round,errorMessage:msg.slice(0,300)},timestamp:Date.now()})}).catch(()=>{});
        throw e;
      }

      if (!this.hasToolCalls(ai)) {
        const openaiMessages = this.langchainThreadToOpenAIMessages(conversation);
        try {
          for await (const part of this.llm.streamChatCompletionsWithMessages({
            model: reasonerModel,
            messages: openaiMessages
          })) {
            if (part.kind === "reasoning" && part.text) yield { kind: "reasoning", text: part.text };
            if (part.kind === "content" && part.text) yield { kind: "content", text: part.text };
          }
        } catch {
          const fallback = this.extractText(ai.content);
          if (fallback) yield { kind: "content", text: fallback };
          else yield { kind: "content", text: "（推理模型暂不可用，且无备用正文）" };
        }
        return;
      }

      conversation.push(ai);

      for (const call of ai.tool_calls) {
        const matched = toolMap.get(call.name);
        const args = this.safeToolArgs(call.args);
        if (!matched) {
          conversation.push(
            new ToolMessage({
              tool_call_id: call.id || call.name,
              content: "未知工具"
            })
          );
          continue;
        }
        try {
          const toolResult = await matched.invoke(call.args ?? {});
          conversation.push(
            new ToolMessage({
              tool_call_id: call.id || call.name,
              content: typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult)
            })
          );
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          conversation.push(
            new ToolMessage({
              tool_call_id: call.id || call.name,
              content: `工具调用失败：${msg}`
            })
          );
        }
      }
    }

    yield { kind: "content", text: "已达到最大工具调用轮次，请缩小问题范围后重试。" };
  }

  private langchainThreadToOpenAIMessages(
    thread: Array<SystemMessage | HumanMessage | AIMessage | ToolMessage>
  ): unknown[] {
    const out: unknown[] = [];
    for (const m of thread) {
      if (m instanceof SystemMessage) {
        out.push({ role: "system", content: this.extractText(m.content) });
      } else if (m instanceof HumanMessage) {
        out.push({ role: "user", content: this.extractText(m.content) });
      } else if (m instanceof AIMessage) {
        const text = this.extractText(m.content);
        const calls = m.tool_calls;
        if (Array.isArray(calls) && calls.length > 0) {
          out.push({
            role: "assistant",
            content: text.length > 0 ? text : null,
            tool_calls: calls.map((tc) => ({
              id: tc.id ?? "",
              type: "function",
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.args ?? {})
              }
            }))
          });
        } else {
          out.push({ role: "assistant", content: text });
        }
      } else if (m instanceof ToolMessage) {
        const c = m.content;
        const content = typeof c === "string" ? c : JSON.stringify(c);
        out.push({
          role: "tool",
          tool_call_id: m.tool_call_id,
          content
        });
      }
    }
    return out;
  }

  private createModel(thinking?: boolean) {
    const apiKey = (process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY || "").trim();
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set");

    const baseURL = (
      process.env.DEEPSEEK_BASE_URL ||
      process.env.LLM_BASE_URL ||
      "https://api.deepseek.com/v1"
    ).replace(/\/+$/, "");

    const model = this.resolveAgentChatModelId();
    const temperature = thinking ? 0.1 : 0.2;

    return new ChatOpenAI({
      apiKey,
      model,
      temperature,
      configuration: { baseURL },
      maxRetries: 2
    });
  }

  private resolveModelName() {
    return this.resolveAgentChatModelId();
  }

  /** 工具调用仅 deepseek-chat（等）支持；reasoner 不能作为 bindTools 模型。 */
  private resolveAgentChatModelId(): string {
    const m = process.env.DEEPAGENTS_MODEL?.trim() || "deepseek-chat";
    if (m === "deepseek-reasoner") return "deepseek-chat";
    return m;
  }

  private hasToolCalls(message: AIMessage): message is AIMessage & { tool_calls: Array<{ id?: string; name: string; args?: Record<string, unknown> }> } {
    return Array.isArray(message.tool_calls) && message.tool_calls.length > 0;
  }

  private extractText(content: unknown): string {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const maybeText = (part as { text?: unknown }).text;
          if (typeof maybeText === "string") return maybeText;
        }
        return "";
      })
      .join("");
  }

  private chunkToAiMessage(chunk: AIMessageChunk): AIMessage {
    return new AIMessage({
      content: chunk.content,
      tool_calls: chunk.tool_calls ?? [],
      invalid_tool_calls: chunk.invalid_tool_calls ?? [],
      additional_kwargs: chunk.additional_kwargs ?? {},
      response_metadata: chunk.response_metadata,
      usage_metadata: chunk.usage_metadata,
      id: chunk.id
    });
  }

  private safeToolArgs(args: unknown): Record<string, unknown> {
    if (!args || typeof args !== "object" || Array.isArray(args)) return {};
    return args as Record<string, unknown>;
  }

  private asPage(v: unknown, fallback: number): number {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return fallback;
    const f = Math.floor(n);
    return Math.max(1, Math.min(100, f));
  }

  private normalizePay(v: unknown): string | undefined {
    if (typeof v !== "string") return undefined;
    const t = v.trim().toLowerCase();
    const map: Record<string, string> = {
      "已支付": "已支付",
      paid: "已支付",
      "待支付": "待支付",
      issued: "待支付",
      "对账中": "对账中",
      partially_paid: "对账中",
      "逾期": "逾期",
      overdue: "逾期"
    };
    return map[t] || undefined;
  }

  private normalizeTicketStatus(v: unknown): string | undefined {
    if (typeof v !== "string") return undefined;
    const t = v.trim().toLowerCase();
    const map: Record<string, string> = {
      new: "new",
      assigned: "assigned",
      in_progress: "in_progress",
      done: "done",
      closed: "closed",
      "新建": "new",
      "已指派": "assigned",
      "处理中": "in_progress",
      "已完成": "done",
      "已关闭": "closed"
    };
    return map[t];
  }

  private normalizeApprovalStatus(v: unknown): string | undefined {
    if (typeof v !== "string") return undefined;
    const t = v.trim().toLowerCase();
    const map: Record<string, string> = {
      pending: "pending",
      approved: "approved",
      rejected: "rejected",
      "待处理": "pending",
      "已通过": "approved",
      "已拒绝": "rejected"
    };
    return map[t];
  }

  private normalizeApprovalActionType(v: unknown): string | undefined {
    if (typeof v !== "string") return undefined;
    const t = v.trim().toLowerCase();
    const map: Record<string, string> = {
      ticket_assign: "ticket_assign",
      ticket_close: "ticket_close",
      billing_create: "billing_create",
      billing_collect: "billing_collect",
      billing_batch_create: "billing_batch_create",
      data_edit: "data_edit",
      "工单指派": "ticket_assign",
      "关闭工单": "ticket_close",
      "创建账单": "billing_create",
      "收缴账单": "billing_collect"
    };
    return map[t];
  }
}
