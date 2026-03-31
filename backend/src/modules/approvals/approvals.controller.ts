import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'
import { ApprovalsService } from './approvals.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

type JwtUser = { userId: number; username: string; roleCode: string }
type AuthedRequest = Request & { user: JwtUser }

@Controller('approvals')
@UseGuards(JwtAuthGuard)
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('actionType') actionType?: string,
  ) {
    return this.approvals.list({
      q,
      status,
      actionType,
    })
  }

  @Patch(':id/approve')
  approve(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.approvals.decide(id, 'approved', req.user.username)
  }

  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: AuthedRequest,
  ) {
    const reason = body?.reason?.trim()
    if (!reason) throw new BadRequestException('请填写拒绝理由')
    return this.approvals.decide(id, 'rejected', req.user.username, reason)
  }
}
