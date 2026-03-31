import { Column, Entity, PrimaryColumn } from "typeorm";

export type BillStatus = "draft" | "issued" | "partially_paid" | "paid" | "overdue";

@Entity("bills")
export class BillEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ name: "customer_name", type: "varchar", length: 128 })
  customerName!: string;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: "varchar", length: 32 })
  status!: BillStatus;

  @Column({ name: "created_at", type: "datetime" })
  createdAt!: Date;
}

