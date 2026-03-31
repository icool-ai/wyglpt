import { Controller, Get, UseGuards } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("dashboard")
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("overview")
  async overview() {
    return this.dashboard.getOverview();
  }

  @Get("ai-metrics")
  async aiMetrics() {
    return this.dashboard.aiMetrics();
  }
}
