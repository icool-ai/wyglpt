import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("billing")
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get("bills")
  async list() {
    return this.billing.list();
  }

  @Post("bills")
  async create(@Body() body: { customerName: string; amount: number }) {
    return this.billing.requestCreate(body);
  }

  @Patch("bills/:id/collect")
  async collect(@Param("id") id: string) {
    return this.billing.requestCollect(id);
  }
}
