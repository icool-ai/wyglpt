import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { TicketsModule } from "../tickets/tickets.module";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [TicketsModule, BillingModule],
  controllers: [DashboardController],
  providers: [DashboardService]
})
export class DashboardModule {}
