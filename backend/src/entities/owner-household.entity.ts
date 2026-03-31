import { Column, Entity, PrimaryColumn } from "typeorm";



@Entity("owner_households")

export class OwnerHouseholdEntity {

  @PrimaryColumn({ type: "varchar", length: 64 })

  id!: string;



  @Column({ type: "varchar", length: 32 })

  room!: string;



  @Column({ name: "owner_name", type: "varchar", length: 128 })

  ownerName!: string;



  @Column({ name: "member_count", type: "int", default: 1 })

  memberCount!: number;



  @Column({ type: "varchar", length: 32 })

  phone!: string;



  /** JSON 字符串，如 ["自住","已认证"] */

  @Column({ type: "text", nullable: true })

  tags!: string | null;



  @Column({ name: "created_at", type: "datetime" })

  createdAt!: Date;

}

