'use client'

import { CheckOutlined, CloseOutlined } from '@ant-design/icons'
import { App, Button, Card, Descriptions, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminShell } from '../../components/AdminShell'
import { apiFetchJson, getAccessToken, getApiBaseUrl } from '../../lib/api'

type Approval = {
  id: string
  actionType: string
  payload: Record<string, unknown>
  summary?: string
  status: string
  createdAt: string
  decidedAt: string | null
  decidedByUsername: string | null
  rejectReason: string | null
}

function actionTypeLabel(t: string): string {
  const m: Record<string, string> = {
    ticket_assign: '工单派单',
    ticket_close: '工单关闭',
    billing_create: '账单创建',
    billing_collect: '账单收缴',
    data_edit: '数据修改',
  }
  return m[t] ?? t
}

function statusLabel(s: string): string {
  const m: Record<string, string> = {
    pending: '待审批',
    approved: '已通过',
    rejected: '已拒绝',
  }
  return m[s] ?? s
}

/** 根据动作类型把 payload 转成一行可读摘要 */
function payloadSummary(actionType: string, payload: Record<string, unknown> | undefined): string {
  const p = payload && typeof payload === 'object' ? payload : {}
  if (actionType === 'ticket_assign') {
    const tid = p.ticketId != null ? String(p.ticketId) : ''
    const assignee = p.assignee != null ? String(p.assignee) : ''
    const uid = p.assigneeUserId != null ? `（用户 ID: ${String(p.assigneeUserId)}）` : ''
    if (tid || assignee) return `工单 ${tid || '—'} → 指派给 ${assignee || '—'}${uid}`
    return '—'
  }
  if (actionType === 'ticket_close') {
    return p.ticketId != null ? `关闭工单 ${String(p.ticketId)}` : '—'
  }
  if (actionType === 'billing_create' || actionType === 'billing_collect') {
    const keys = Object.keys(p)
    if (!keys.length) return '—'
    try {
      return JSON.stringify(p).slice(0, 200) + (JSON.stringify(p).length > 200 ? '…' : '')
    } catch {
      return '—'
    }
  }
  try {
    const s = JSON.stringify(p)
    return s.length > 180 ? `${s.slice(0, 180)}…` : s || '—'
  } catch {
    return '—'
  }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('zh-CN')
  } catch {
    return String(iso)
  }
}

export default function ApprovalsPage() {
  const { message } = App.useApp()
  const [rejectForm] = Form.useForm<{ reason: string }>()
  const [rows, setRows] = useState<Approval[]>([])
  const [loading, setLoading] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailRecord, setDetailRecord] = useState<Approval | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<Approval | null>(null)
  const [rejectSubmitting, setRejectSubmitting] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [actionTypeFilter, setActionTypeFilter] = useState<string | undefined>(undefined)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      const q = searchText.trim()
      if (q) params.set('q', q)
      if (statusFilter) params.set('status', statusFilter)
      if (actionTypeFilter) params.set('actionType', actionTypeFilter)
      const query = params.toString()
      const url = `${getApiBaseUrl()}/approvals${query ? `?${query}` : ''}`
      const data = await apiFetchJson<Approval[]>(url, {
        method: 'GET',
      })
      setRows(data)
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [actionTypeFilter, message, searchText, statusFilter])

  const approve = useCallback(
    async (id: string) => {
      const base = getApiBaseUrl()
      try {
        await apiFetchJson(`${base}/approvals/${encodeURIComponent(id)}/approve`, {
          method: 'PATCH',
        })
        await apiFetchJson(`${base}/ai/candidate/execute/${encodeURIComponent(id)}`, {
          method: 'PATCH',
        })
        message.success('已通过并执行')
        await reload()
      } catch (e: unknown) {
        message.error(e instanceof Error ? e.message : '操作失败')
      }
    },
    [message, reload],
  )

  const reject = useCallback(
    async (id: string, reason: string) => {
      const base = getApiBaseUrl()
      try {
        setRejectSubmitting(true)
        await apiFetchJson(`${base}/approvals/${encodeURIComponent(id)}/reject`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        })
        message.success('已拒绝')
        setRejectOpen(false)
        setRejectTarget(null)
        rejectForm.resetFields()
        await reload()
      } catch (e: unknown) {
        message.error(e instanceof Error ? e.message : '操作失败')
      } finally {
        setRejectSubmitting(false)
      }
    },
    [message, reload, rejectForm],
  )

  useEffect(() => {
    if (!getAccessToken()) {
      window.location.href = '/login'
      return
    }
    void reload()
  }, [reload])

  const columns: ColumnsType<Approval> = useMemo(
    () => [
      {
        title: '审批单号',
        dataIndex: 'id',
        key: 'id',
        width: 220,
        ellipsis: true,
        render: (id: string) => (
          <Typography.Text copyable={{ text: id }} className="text-xs font-mono text-slate-700">
            {id}
          </Typography.Text>
        ),
      },
      {
        title: '动作类型',
        dataIndex: 'actionType',
        key: 'actionType',
        width: 120,
        render: (t: string) => <Tag color="purple">{actionTypeLabel(t)}</Tag>,
      },
      {
        title: '摘要 / 内容',
        key: 'summary',
        ellipsis: true,
        render: (_, r) => (
          <Typography.Text type="secondary" className="text-sm">
            {r.summary || payloadSummary(r.actionType, r.payload)}
          </Typography.Text>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: (s: string) => (
          <Tag color={s === 'pending' ? 'orange' : s === 'approved' ? 'success' : 'default'}>
            {statusLabel(s)}
          </Tag>
        ),
      },
      {
        title: '申请时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 168,
        render: (t: string) => (
          <span className="tabular-nums text-slate-600 text-sm">{t ? new Date(t).toLocaleString('zh-CN') : '—'}</span>
        ),
      },
      {
        title: '审批人',
        dataIndex: 'decidedByUsername',
        key: 'approver',
        width: 110,
        render: (_: unknown, r) =>
          r.status === 'pending' ? (
            <Typography.Text type="secondary">—</Typography.Text>
          ) : (
            <span className="text-slate-700 text-sm">{r.decidedByUsername || '—'}</span>
          ),
      },
      {
        title: '审批时间',
        dataIndex: 'decidedAt',
        key: 'decidedAt',
        width: 168,
        render: (t: string | null, r) =>
          r.status === 'pending' ? (
            <Typography.Text type="secondary">—</Typography.Text>
          ) : (
            <span className="tabular-nums text-slate-600 text-sm">
              {t ? new Date(t).toLocaleString('zh-CN') : '—'}
            </span>
          ),
      },
      {
        title: '操作',
        key: 'actions',
        width: 300,
        fixed: 'right',
        render: (_, record) => (
          <Space size="small" wrap >
            <Button
              type="link"
              size="small"
              className="!px-1"
              onClick={() => {
                setDetailRecord(record)
                setDetailOpen(true)
              }}
            >
              详情
            </Button>
            {record.status === 'pending' ? (
              <>
                <Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => approve(record.id)}>
                  通过并执行
                </Button>
                <Button
                  danger
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => {
                    setRejectTarget(record)
                    rejectForm.setFieldValue('reason', '')
                    setRejectOpen(true)
                  }}
                >
                  拒绝
                </Button>
              </>
            ) : null}
          </Space>
        ),
      },
    ],
    [approve, rejectForm],
  )

  return (
    <AdminShell title="审批中心">
      <Card className="shadow-sm border border-slate-100">
        <Space direction="vertical" className="w-full" size="middle">
          <Typography.Text type="secondary">
            高风险操作与账单创建将在此聚合；通过后可触发后端执行对应业务动作。动作类型、状态已中文展示；审批通过/拒绝会记录当前登录账号为审批人。
          </Typography.Text>
          <Space wrap>
            <Input
              allowClear
              placeholder="搜索审批单号/摘要/类型/状态"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={() => void reload()}
              style={{ width: 320 }}
            />
            <Select
              allowClear
              placeholder="筛选状态"
              style={{ width: 140 }}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v)}
              options={[
                { value: 'pending', label: '待审批' },
                { value: 'approved', label: '已通过' },
                { value: 'rejected', label: '已拒绝' },
              ]}
            />
            <Select
              allowClear
              placeholder="筛选动作"
              style={{ width: 180 }}
              value={actionTypeFilter}
              onChange={(v) => setActionTypeFilter(v)}
              options={[
                { value: 'ticket_assign', label: actionTypeLabel('ticket_assign') },
                { value: 'ticket_close', label: actionTypeLabel('ticket_close') },
                { value: 'billing_create', label: actionTypeLabel('billing_create') },
                { value: 'billing_collect', label: actionTypeLabel('billing_collect') },
                { value: 'data_edit', label: actionTypeLabel('data_edit') },
              ]}
            />
            <Button type="primary" onClick={() => void reload()}>
              查询
            </Button>
            <Button
              onClick={() => {
                setSearchText('')
                setStatusFilter(undefined)
                setActionTypeFilter(undefined)
              }}
            >
              重置
            </Button>
          </Space>
          <Table<Approval>
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={rows}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            scroll={{ x: 1320 }}
          />
        </Space>
      </Card>

      <Modal
        title="审批详情"
        open={detailOpen}
        width={720}
        onCancel={() => {
          setDetailOpen(false)
          setDetailRecord(null)
        }}
        footer={
          <Button
            type="primary"
            onClick={() => {
              setDetailOpen(false)
              setDetailRecord(null)
            }}
          >
            关闭
          </Button>
        }
        destroyOnClose
      >
        {detailRecord ? (
          <Descriptions bordered column={1} size="small" labelStyle={{ width: 140 }}>
            <Descriptions.Item label="审批单号">
              <Typography.Text copyable={{ text: detailRecord.id }} className="font-mono text-xs">
                {detailRecord.id}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="动作类型">
              <Space direction="vertical" size={0}>
                <Tag color="purple">{actionTypeLabel(detailRecord.actionType)}</Tag>
                <Typography.Text type="secondary" className="text-xs">
                  原始值：{detailRecord.actionType}
                </Typography.Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag
                color={
                  detailRecord.status === 'pending'
                    ? 'orange'
                    : detailRecord.status === 'approved'
                      ? 'success'
                      : 'default'
                }
              >
                {statusLabel(detailRecord.status)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="摘要">
              {detailRecord.summary || payloadSummary(detailRecord.actionType, detailRecord.payload)}
            </Descriptions.Item>
            <Descriptions.Item label="申请时间">{formatDateTime(detailRecord.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="审批人">
              {detailRecord.status === 'pending' ? '—' : detailRecord.decidedByUsername || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="审批时间">
              {detailRecord.status === 'pending' ? '—' : formatDateTime(detailRecord.decidedAt)}
            </Descriptions.Item>
            <Descriptions.Item label="审批结果">
              {detailRecord.status === 'pending'
                ? '待审批'
                : detailRecord.status === 'approved'
                  ? '审批通过，已执行对应业务动作'
                  : '审批拒绝，未执行业务动作'}
            </Descriptions.Item>
            <Descriptions.Item label="拒绝理由">
              {detailRecord.status === 'rejected' ? detailRecord.rejectReason || '—' : '—'}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>

      <Modal
        title={`拒绝审批：${rejectTarget?.id ?? ''}`}
        open={rejectOpen}
        onCancel={() => {
          setRejectOpen(false)
          setRejectTarget(null)
          rejectForm.resetFields()
        }}
        onOk={() => {
          void (async () => {
            if (!rejectTarget) return
            const v = await rejectForm.validateFields()
            await reject(rejectTarget.id, (v.reason || '').trim())
          })()
        }}
        okText="确认拒绝"
        okButtonProps={{ danger: true }}
        confirmLoading={rejectSubmitting}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary" className="!mb-3 !text-sm">
          请填写拒绝理由，提交后将记录审批人、审批时间与理由，且该审批单不可再次审批。
        </Typography.Paragraph>
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            label="拒绝理由"
            name="reason"
            rules={[
              { required: true, message: '请填写拒绝理由' },
              { max: 500, message: '拒绝理由最多 500 个字符' },
            ]}
          >
            <Input.TextArea rows={4} showCount maxLength={500} placeholder="请说明拒绝原因，例如：信息不完整、派单对象不匹配等" />
          </Form.Item>
        </Form>
      </Modal>
    </AdminShell>
  )
}
