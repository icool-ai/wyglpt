import { Column, Entity, PrimaryColumn } from "typeorm";

export type BillStatus = "draft" | "issued" | "partially_paid" | "paid" | "overdue";

@Entity("bills")
export class BillEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ name: "bill_type", type: "varchar", length: 32, nullable: true })
  type!: string;

  @Column({ name: "customer_name", type: "varchar", length: 128 })
  owner!: string;

  // 账期开始（复用旧列：billing_period）
  @Column({ name: "billing_period", type: "varchar", length: 32, nullable: true })
  periodStart!: string;

  // 账期结束
  @Column({ name: "billing_period_end", type: "varchar", length: 32, nullable: true })
  periodEnd!: string;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: "varchar", length: 32 })
  status!: BillStatus;

  @Column({ name: "created_at", type: "datetime" })
  createdAt!: Date;
}

