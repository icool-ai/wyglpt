import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly auth: AuthService) {}

  /** 派单时可选择的处理人（物业内部账号） */
  @Get("assignable")
  async assignable() {
    return this.auth.listAssignableUsers();
  }
}

