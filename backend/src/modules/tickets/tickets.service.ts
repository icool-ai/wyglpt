import { InjectRepository } from "@nestjs/typeorm";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Repository } from "typeorm";
import { ASSIGNABLE_HANDLER_ROLE_CODES } from "../auth/auth.service";
import { UserEntity } from "../../entities/user.entity";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ApprovalsService } from "../approvals/approvals.service";
import { TicketEntity, TicketStatus } from "../../entities/ticket.entity";

export type TicketDto = {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  assignee?: string | null;
  createdAt: string;
};

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(TicketEntity)
    private readonly ticketsRepo: Repository<TicketEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    private readonly approvals: ApprovalsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService
  ) {}

  async create(payload: { title: string; description: string }) {
    const row = await this.ticketsRepo.save({
      id: `tk_${Date.now()}`,
      title: payload.title,
      description: payload.description,
      status: "new",
      assignee: null,
      createdAt: new Date()
    });

    await this.audit.recordStrictAudit({
      actor: "system",
      action: "ticket_create",
      entityType: "ticket",
      entityId: row.id,
      diff: {
        id: row.id,
        title: row.title,
        status: row.status
      }
    });

    return this.toDto(row);
  }

  async list() {
    const rows = await this.ticketsRepo.find({ order: { createdAt: "DESC" } });
    return rows.map((x) => this.toDto(x));
  }

  async assign(id: string, body: { assignee?: string; assigneeUserId?: number }) {
    const ticket = await this.mustFind(id);
    let assignee = (body.assignee ?? "").trim();
    const uid = body.assigneeUserId;
    if (uid != null && Number.isFinite(uid)) {
      const user = await this.usersRepo.findOne({ where: { id: uid } });
      if (!user) throw new BadRequestException("所选处理人不存在");
      if (!(ASSIGNABLE_HANDLER_ROLE_CODES as readonly string[]).includes(user.roleCode)) {
        throw new BadRequestException("该账号不可作为工单处理人");
      }
      assignee = user.displayName;
    }
    if (!assignee) throw new BadRequestException("请选择处理人");
    const approval = await this.approvals.create("ticket_assign", {
      ticketId: id,
      assignee,
      ...(uid != null && Number.isFinite(uid) ? { assigneeUserId: uid } : {})
    });
    await this.notifications.sendInApp(
      "admin",
      "审批待处理",
      `工单 ${id} 派工需要审批: ${approval.id}`
    );
    return { ticket: this.toDto(ticket), approval };
  }

  async close(id: string) {
    const ticket = await this.mustFind(id);
    const approval = await this.approvals.create("ticket_close", { ticketId: id });
    return { ticket: this.toDto(ticket), approval };
  }

  async executeApproved(actionType: string, payload: Record<string, unknown>) {
    if (actionType === "ticket_assign") {
      const ticket = await this.mustFind(String(payload.ticketId));
      ticket.assignee = String(payload.assignee || "");
      ticket.status = "assigned";
      const saved = await this.ticketsRepo.save(ticket);
      return this.toDto(saved);
    }

    if (actionType === "ticket_close") {
      const ticket = await this.mustFind(String(payload.ticketId));
      ticket.status = "closed";
      const saved = await this.ticketsRepo.save(ticket);
      return this.toDto(saved);
    }

    return null;
  }

  private async mustFind(id: string) {
    const ticket = await this.ticketsRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException("Ticket not found");
    return ticket;
  }

  private toDto(row: TicketEntity): TicketDto {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      assignee: row.assignee ?? null,
      createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt)
    };
  }
}
