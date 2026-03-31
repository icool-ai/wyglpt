import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("roles")
export class RoleEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 64, unique: true })
  code!: string;

  @Column({ type: "varchar", length: 128 })
  name!: string;
}

