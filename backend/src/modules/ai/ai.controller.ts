import { Body, Controller, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AiService } from "./ai.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("ai")
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post("ticket-triage")
  async triage(@Body() body: { ticketId: string; issueType: string }) {
    return this.ai.generateTicketTriage(body);
  }

  @Post("ticket-summary")
  async summary(@Body() body: { title: string; description: string }) {
    return this.ai.summarizeTicket(body);
  }

  @Post("kpi-insight")
  async insight(@Body() body: { metric: string; current: number; previous: number }) {
    return this.ai.explainKpi(body);
  }

  @Post("candidate/submit")
  async submitCandidate(@Body() body: { actionType: any; reason: string; payload: Record<string, unknown> }) {
    return this.ai.requestExecution({
      actionType: body.actionType,
      reason: body.reason,
      payload: body.payload,
      requiresApproval: true
    });
  }

  @Patch("candidate/execute/:approvalId")
  async execute(@Param("approvalId") approvalId: string) {
    return this.ai.executeApproved(approvalId);
  }
}
