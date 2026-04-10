import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { DeepAgentsService } from "./deepagents.service";
import { TicketsModule } from "../tickets/tickets.module";
import { BillingModule } from "../billing/billing.module";
import { ApprovalsModule } from "../approvals/approvals.module";
import { LlmModule } from "../llm/llm.module";
import { OwnersModule } from "../owners/owners.module";
import { DashboardModule } from "../dashboard/dashboard.module";

@Module({
  imports: [TicketsModule, BillingModule, ApprovalsModule, OwnersModule, DashboardModule, LlmModule],
  controllers: [AiController],
  providers: [AiService, DeepAgentsService],
  exports: [AiService, DeepAgentsService]
})
export class AiModule {}
