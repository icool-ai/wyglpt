import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("users")
export class UserEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 128, unique: true })
  username!: string;

  @Column({ type: "varchar", length: 128 })
  displayName!: string;

  @Column({ type: "varchar", length: 64 })
  roleCode!: string;

  @Column({ name: "password_hash", type: "varchar", length: 255 })
  passwordHash!: string;

  @Column({ name: "created_at", type: "datetime", nullable: true })
  createdAt?: Date;
}

