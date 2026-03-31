import { InjectRepository } from "@nestjs/typeorm";
import { Injectable, Logger } from "@nestjs/common";
import { Repository } from "typeorm";
import { AuditLogEntity } from "../../entities/audit-log.entity";

export type AuditRecord = {
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  reason?: string;
  maskedInput?: Record<string, unknown>;
  diff?: Record<string, unknown>;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repo: Repository<AuditLogEntity>
  ) {}

  async recordStrictAudit(record: AuditRecord): Promise<void> {
    this.logger.log(`[AUDIT] ${record.action} ${record.entityType}:${record.entityId} by ${record.actor}`);
    await this.repo.save({
      actor: record.actor,
      action: record.action,
      entityType: record.entityType,
      entityId: record.entityId,
      reason: record.reason,
      maskedInputJson: record.maskedInput ?? null,
      diffJson: record.diff ?? null,
      createdAt: new Date()
    });
  }
}
