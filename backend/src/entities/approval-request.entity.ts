import { Column, Entity, PrimaryColumn } from 'typeorm'

export type ApprovalActionType =
  | 'ticket_assign'
  | 'ticket_close'
  | 'billing_create'
  | 'billing_collect'
  | 'data_edit'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

@Entity('approval_requests')
export class ApprovalRequestEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string

  @Column({ name: 'action_type', type: 'varchar', length: 64 })
  actionType!: ApprovalActionType

  @Column({ name: 'payload_json', type: 'json' })
  payloadJson!: Record<string, unknown>

  @Column({ type: 'varchar', length: 32 })
  status!: ApprovalStatus

  @Column({ name: 'created_at', type: 'datetime' })
  createdAt!: Date

  /** 审批通过/拒绝时间 */
  @Column({ name: 'decided_at', type: 'datetime', nullable: true })
  decidedAt?: Date | null

  /** 审批人登录名（JWT 当前用户） */
  @Column({
    name: 'decided_by_username',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  decidedByUsername?: string | null

  /** 拒绝理由（仅 rejected 时填写） */
  @Column({ name: 'reject_reason', type: 'varchar', length: 500, nullable: true })
  rejectReason?: string | null
}
