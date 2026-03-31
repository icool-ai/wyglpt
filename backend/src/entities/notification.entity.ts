import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("notifications")
export class NotificationEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 32 })
  channel!: string;

  @Column({ type: "varchar", length: 128 })
  target!: string;

  @Column({ type: "text" })
  content!: string;

  @Column({ name: "created_at", type: "datetime" })
  createdAt!: Date;
}

