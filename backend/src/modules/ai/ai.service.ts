import { Injectable, NotFoundException } from "@nestjs/common";
import { ApprovalsService } from "../approvals/approvals.service";
import { BillingService } from "../billing/billing.service";
import { AuditService } from "../audit/audit.service";
import { TicketsService } from "../tickets/tickets.service";
import { LlmService } from "../llm/llm.service";

export type CandidateAction = {
  actionType: "ticket_assign" | "ticket_close" | "billing_create" | "billing_collect" | "data_edit";
  reason: string;
  payload: Record<string, unknown>;
  requiresApproval: boolean;
};

@Injectable()
export class AiService {
  constructor(
    private readonly approvals: ApprovalsService,
    private readonly tickets: TicketsService,
    private readonly billing: BillingService,
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
