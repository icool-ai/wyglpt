import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("audit_logs")
export class AuditLogEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 128 })
  actor!: string;

  @Column({ type: "varchar", length: 128 })
  action!: string;

  @Column({ name: "entity_type", type: "varchar", length: 64 })
  entityType!: string;

  @Column({ name: "entity_id", type: "varchar", length: 64 })
  entityId!: string;

  @Column({ type: "text", nullable: true })
  reason?: string | null;

  @Column({ name: "masked_input_json", type: "json", nullable: true })
  maskedInputJson?: Record<string, unknown> | null;

  @Column({ name: "diff_json", type: "json", nullable: true })
  diffJson?: Record<string, unknown> | null;

  @Column({ name: "created_at", type: "datetime" })
  createdAt!: Date;
}

