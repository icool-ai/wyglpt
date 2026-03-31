import { InjectRepository } from '@nestjs/typeorm'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Repository } from 'typeorm'
import {
  ApprovalActionType,
  ApprovalRequestEntity,
  ApprovalStatus,
} from '../../entities/approval-request.entity'

export type ApprovalRequestDto = {
  id: string
  actionType: ApprovalActionType
  payload: Record<string, unknown>
  summary: string
  status: ApprovalStatus
  createdAt: string
  decidedAt: string | null
  decidedByUsername: string | null
  rejectReason: string | null
}

type ApprovalListQuery = {
  q?: string
  status?: string
  actionType?: string
}

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectRepository(ApprovalRequestEntity)
    private readonly repo: Repository<ApprovalRequestEntity>,
  ) {}

  async create(
    actionType: ApprovalActionType,
    payload: Record<string, unknown>,
  ) {
    const row: ApprovalRequestEntity = {
      id: `apr_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
      actionType,
      payloadJson: payload,
      status: 'pending',
      createdAt: new Date(),
    }
    return this.repo.save(row)
  }

  async list(query: ApprovalListQuery = {}) {
    const rows = await this.repo.find({ order: { createdAt: 'DESC' } })
    const q = query.q?.trim().toLowerCase()
    const status = query.status?.trim()
    const actionType = query.actionType?.trim()

    return rows
      .filter((x) => {
        if (status && x.status !== status) return false
        if (actionType && x.actionType !== actionType) return false
        return true
      })
      .map((x) => this.toDto(x))
      .filter((x) => {
        if (!q) return true
        return (
          x.id.toLowerCase().includes(q) ||
          x.actionType.toLowerCase().includes(q) ||
          x.status.toLowerCase().includes(q) ||
          x.summary.toLowerCase().includes(q)
        )
      })
  }

  async decide(
    id: string,
    status: 'approved' | 'rejected',
    decidedByUsername?: string,
    rejectReason?: string,
  ) {
    const item = await this.repo.findOne({ where: { id } })
    if (!item) throw new NotFoundException('Approval not found')
    if (item.status !== 'pending') {
      throw new BadRequestException('该审批单已处理，不能重复审批')
    }
    item.status = status
    item.decidedAt = new Date()
    item.decidedByUsername = decidedByUsername?.trim() || null
    if (status === 'rejected') {
      const reason = (rejectReason ?? '').trim()
      if (!reason) throw new BadRequestException('请填写拒绝理由')
      item.rejectReason = reason.slice(0, 500)
    } else {
      item.rejectReason = null
    }
    await this.repo.save(item)
    return this.toDto(item)
  }

  private toDto(x: ApprovalRequestEntity): ApprovalRequestDto {
    const payload = x.payloadJson
    return {
      id: x.id,
      actionType: x.actionType,
      payload,
      summary: this.buildSummary(x.actionType, payload),
      status: x.status,
      createdAt: x.createdAt?.toISOString?.() ?? String(x.createdAt),
      decidedAt: x.decidedAt?.toISOString?.() ?? null,
      decidedByUsername: x.decidedByUsername ?? null,
      rejectReason: x.rejectReason ?? null,
    }
  }

  private buildSummary(
    actionType: ApprovalActionType,
    payload: Record<string, unknown> | undefined,
  ): string {
    const p = payload && typeof payload === 'object' ? payload : {}
    if (actionType === 'ticket_assign') {
      const tid = p.ticketId != null ? String(p.ticketId) : '—'
      const assignee = p.assignee != null ? String(p.assignee) : '—'
      return `工单 ${tid} 指派给 ${assignee}`
    }

    if (actionType === 'ticket_close') {
      const tid = p.ticketId != null ? String(p.ticketId) : '—'
      return `关闭工单 ${tid}`
    }

    if (actionType === 'billing_create') {
      const customerName = p.customerName != null ? String(p.customerName) : '—'
      const amount = p.amount != null ? String(p.amount) : '—'
      return `创建账单：客户 ${customerName}，金额 ${amount}`
    }

    if (actionType === 'billing_collect') {
      const billId = p.billId != null ? String(p.billId) : '—'
      return `收缴账单：${billId}`
    }

    if (actionType === 'data_edit') {
      const entityType = p.entityType != null ? String(p.entityType) : '—'
      const entityId = p.entityId != null ? String(p.entityId) : '—'
      return `数据修改：${entityType}#${entityId}`
    }

    try {
      const s = JSON.stringify(p)
      return s.length > 180 ? `${s.slice(0, 180)}...` : s || '—'
    } catch {
      return '—'
    }
  }
}
