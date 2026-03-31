import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { TicketsService } from "./tickets.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("tickets")
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  async list() {
    return this.tickets.list();
  }

  @Post()
  async create(@Body() body: { title: string; description: string }) {
    return this.tickets.create(body);
  }

  @Patch(":id/assign")
  async assign(
    @Param("id") id: string,
    @Body() body: { assignee?: string; assigneeUserId?: number }
  ) {
    return this.tickets.assign(id, body);
  }

  @Patch(":id/close")
  async close(@Param("id") id: string) {
    return this.tickets.close(id);
  }
}
