import { Column, Entity, PrimaryColumn } from "typeorm";

export type TicketStatus = "new" | "assigned" | "in_progress" | "done" | "closed";

@Entity("tickets")
export class TicketEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "text" })
  description!: string;

  @Column({ type: "varchar", length: 32 })
  status!: TicketStatus;

  @Column({ type: "varchar", length: 128, nullable: true })
  assignee?: string | null;

  @Column({ name: "created_at", type: "datetime" })
  createdAt!: Date;
}

