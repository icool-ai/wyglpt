import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { TicketsModule } from "../tickets/tickets.module";
import { BillingModule } from "../billing/billing.module";
import { ApprovalsModule } from "../approvals/approvals.module";
import { LlmModule } from "../llm/llm.module";

@Module({
  imports: [TicketsModule, BillingModule, ApprovalsModule, LlmModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService]
})
export class AiModule {}
