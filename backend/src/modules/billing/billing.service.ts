import { InjectRepository } from "@nestjs/typeorm";
import { Injectable, NotFoundException } from "@nestjs/common";
import { Repository } from "typeorm";
import { AuditService } from "../audit/audit.service";
import { ApprovalsService } from "../approvals/approvals.service";
import { BillEntity, BillStatus } from "../../entities/bill.entity";

export type BillDto = {
  id: string;
  customerName: string;
  amount: number;
  status: BillStatus;
  createdAt: string;
};

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(BillEntity)
    private readonly billsRepo: Repository<BillEntity>,
    private readonly approvals: ApprovalsService,
    private readonly audit: AuditService
  ) {}

  async list() {
    const rows = await this.billsRepo.find({ order: { createdAt: "DESC" } });
    return rows.map((x) => this.toDto(x));
  }

  async requestCreate(payload: { customerName: string; amount: number }) {
    return this.approvals.create("billing_create", payload);
  }

  async requestCollect(id: string) {
    await this.mustFind(id);
    return this.approvals.create("billing_collect", { billId: id, op: "collect" });
  }

  async executeApproved(actionType: string, payload: Record<string, unknown>) {
    if (actionType === "billing_create") {
      const row = await this.billsRepo.save({
        id: `bill_${Date.now()}`,
        customerName: String(payload.customerName || ""),
        amount: Number(payload.amount || 0),
        status: "issued",
        createdAt: new Date()
      });

      await this.audit.recordStrictAudit({
        actor: "approver",
        action: "billing_create",
        entityType: "bill",
        entityId: row.id,
        diff: { id: row.id, status: row.status }
      });
      return this.toDto(row);
    }

    if (actionType === "billing_collect") {
      const bill = await this.mustFind(String(payload.billId));
      bill.status = "paid";
      const saved = await this.billsRepo.save(bill);
      return this.toDto(saved);
    }

    return null;
  }

  private async mustFind(id: string) {
    const bill = await this.billsRepo.findOne({ where: { id } });
    if (!bill) throw new NotFoundException("Bill not found");
    return bill;
  }

  private toDto(row: BillEntity): BillDto {
    return {
      id: row.id,
      customerName: row.customerName,
      amount: Number(row.amount),
      status: row.status,
      createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt)
    };
  }
}
