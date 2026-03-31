'use client'

import { PlusOutlined } from '@ant-design/icons'
import { Alert, App, Button, Card, Form, Input, Modal, Select, Spin, Table, Tabs, Tag, Timeline, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminShell } from '../../components/AdminShell'
import { apiFetchJson, getAccessToken, getApiBaseUrl } from '../../lib/api'

/** 与后端 TicketStatus 对应 */
type TicketApi = {
  id: string
  title: string
  description: string
  status: string
  assignee: string | null
  createdAt: string
}

type AssignableUser = {
  id: number
  username: string
  displayName: string
  roleCode: string
}

function statusLabel(raw: string): string {
  const m: Record<string, string> = {
    new: '待受理',
    assigned: '已派单',
    in_progress: '处理中',
    done: '已完成',
    closed: '已关闭',
  }
  return m[raw] ?? raw
}

/** 看板四列归类（done/closed 归入「已完成」） */
function boardColumn(raw: string): string {
  if (raw === 'new') return '待受理'
  if (raw === 'assigned') return '待接单'
  if (raw === 'in_progress') return '处理中'
  if (raw === 'done' || raw === 'closed') return '已完成'
  return '待受理'
}

const statusColor: Record<string, string> = {
  待受理: 'default',
  待接单: 'processing',
  已派单: 'cyan',
  处理中: 'blue',
  已完成: 'success',
  已关闭: 'default',
  待确认: 'orange',
  已取消: 'default',
  挂起: 'warning',
}

const BOARD_COLS = ['待受理', '待接单', '处理中', '已完成'] as const

export default function TicketsPage() {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [assignForm] = Form.useForm<{ assigneeUserId: number }>()
  const [tab, setTab] = useState('list')
  const [tickets, setTickets] = useState<TicketApi[]>([])
  const [loading, setLoading] = useState(true)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignTarget, setAssignTarget] = useState<TicketApi | null>(null)
  const [assignSubmitting, setAssignSubmitting] = useState(false)
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([])
  const [assignableLoading, setAssignableLoading] = useState(false)

  const loadTickets = useCallback(async () => {
    setLoading(true)
    try {
      const list = await apiFetchJson<TicketApi[]>(`${getApiBaseUrl()}/tickets`, { method: 'GET' })
      setTickets(list)
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '加载工单失败')
      setTickets([])
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    if (!getAccessToken()) {
      window.location.href = '/login'
      return
    }
    void loadTickets()
  }, [loadTickets])

  async function createTicket() {
    try {
      const v = await form.validateFields()
      await apiFetchJson<{ id: string }>(`${getApiBaseUrl()}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: v.title, description: v.description }),
      })
      message.success('工单已创建')
      form.resetFields()
      await loadTickets()
      setTab('list')
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in e) return
      message.error(e instanceof Error ? e.message : '创建失败')
    }
  }

  const loadAssignableUsers = useCallback(async () => {
    setAssignableLoading(true)
    try {
      const list = await apiFetchJson<AssignableUser[]>(`${getApiBaseUrl()}/users/assignable`, { method: 'GET' })
      setAssignableUsers(list)
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '加载可指派人员失败')
      setAssignableUsers([])
    } finally {
      setAssignableLoading(false)
    }
  }, [message])

  const openAssignModal = useCallback(
    (record: TicketApi) => {
      setAssignTarget(record)
      assignForm.resetFields()
      setAssignOpen(true)
      void loadAssignableUsers()
    },
    [assignForm, loadAssignableUsers],
  )

  async function submitAssign() {
    if (!assignTarget) return
    try {
      const v = await assignForm.validateFields()
      setAssignSubmitting(true)
      await apiFetchJson(`${getApiBaseUrl()}/tickets/${encodeURIComponent(assignTarget.id)}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeUserId: v.assigneeUserId }),
      })
      message.success('派单已提交审批，请在「审批中心」通过后会自动指派给处理人')
      setAssignOpen(false)
      setAssignTarget(null)
      assignForm.resetFields()
      await loadTickets()
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in e) return
      message.error(e instanceof Error ? e.message : '提交失败')
    } finally {
      setAssignSubmitting(false)
    }
  }

  const columns: ColumnsType<TicketApi> = useMemo(
    () => [
      { title: '单号', dataIndex: 'id', key: 'id', width: 160, fixed: 'left', ellipsis: true },
      { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: (raw: string) => {
          const label = statusLabel(raw)
          return <Tag color={statusColor[label] || 'default'}>{label}</Tag>
        },
      },
      {
        title: '处理人',
        dataIndex: 'assignee',
        key: 'assignee',
        width: 100,
        render: (a: string | null) => a || '—',
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 180,
        render: (t: string) => (
          <span className="tabular-nums text-slate-600 text-sm">{t ? new Date(t).toLocaleString('zh-CN') : '—'}</span>
        ),
      },
      {
        title: '描述',
        dataIndex: 'description',
        key: 'description',
        ellipsis: true,
        render: (d: string) => <Typography.Text type="secondary" className="text-sm">{d}</Typography.Text>,
      },
      {
        title: '操作',
        key: 'actions',
        width: 100,
        fixed: 'right',
        render: (_, record) =>
          record.status === 'new' ? (
            <Button type="link" size="small" className="!p-0" onClick={() => openAssignModal(record)}>
              派单
            </Button>
          ) : (
            <Typography.Text type="secondary" className="text-sm">
              —
            </Typography.Text>
          ),
      },
    ],
    [openAssignModal],
  )

  return (
    <AdminShell title="工单管理">
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'list',
            label: '列表视图',
            children: (
              <Card className="shadow-sm border border-slate-100">
                <Alert
                  type="info"
                  showIcon
                  className="mb-4"
                  message="待受理工单如何派单？"
                  description={
                    <span>
                      在列表中点击「派单」，从下拉框选择系统内处理人账号后提交（会走审批）。通过后工单变为「已派单」并显示处理人。请到{' '}
                      <Link href="/approvals" className="text-[#7c3aed] font-medium">
                        审批中心
                      </Link>{' '}
                      处理「ticket_assign」类审批。
                    </span>
                  }
                />
                <Spin spinning={loading}>
                  <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={tickets}
                    size="middle"
                    pagination={{ pageSize: 8, showSizeChanger: true }}
                    scroll={{ x: 1080 }}
                    locale={{ emptyText: '暂无工单，请在下方「新建工单」创建' }}
                  />
                </Spin>
              </Card>
            ),
          },
          {
            key: 'board',
            label: '状态看板',
            children: (
              <Spin spinning={loading}>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {BOARD_COLS.map((col) => {
                    const inCol = tickets.filter((r) => boardColumn(r.status) === col)
                    return (
                      <Card key={col} size="small" title={col} className="shadow-sm border border-slate-100 min-h-[200px]">
                        {inCol.map((r) => (
                          <div
                            key={r.id}
                            className="mb-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 cursor-default transition-colors hover:border-violet-200"
                          >
                            <Typography.Text strong className="text-sm block">
                              {r.title}
                            </Typography.Text>
                            <Typography.Text type="secondary" className="text-xs">
                              {r.id} · {statusLabel(r.status)}
                            </Typography.Text>
                          </div>
                        ))}
                        {inCol.length === 0 ? (
                          <Typography.Text type="secondary" className="text-sm">
                            暂无
                          </Typography.Text>
                        ) : null}
                      </Card>
                    )
                  })}
                </div>
              </Spin>
            ),
          },
          {
            key: 'timeline',
            label: '流程说明',
            children: (
              <Card className="shadow-sm border border-slate-100 max-w-2xl">
                <Typography.Paragraph type="secondary">
                  与设计系统一致的主状态：待受理 → 已派单/待接单 → 处理中 → 待确认 → 已完成 / 已关闭 / 已取消 / 挂起。
                </Typography.Paragraph>
                <Timeline
                  items={[
                    { children: '业主或后台创建工单' },
                    { children: '调度受理并派单 / 物业 H5 接单' },
                    { children: '现场处理与反馈' },
                    { children: '业主或管理员确认闭环' },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title={`派单：${assignTarget?.title ?? ''}`}
        open={assignOpen}
        onCancel={() => {
          setAssignOpen(false)
          setAssignTarget(null)
          assignForm.resetFields()
        }}
        onOk={() => void submitAssign()}
        confirmLoading={assignSubmitting}
        okText="提交审批"
        destroyOnClose
      >
        <Typography.Paragraph type="secondary" className="!text-sm !mb-3">
          提交后将生成审批单，审批通过后工单状态会变为「已派单」，并记录处理人。
        </Typography.Paragraph>
        <Form form={assignForm} layout="vertical">
          <Form.Item
            label="处理人"
            name="assigneeUserId"
            rules={[{ required: true, message: '请选择处理人' }]}
          >
            <Select
              placeholder="选择可接单的内部账号"
              allowClear
              showSearch
              loading={assignableLoading}
              optionFilterProp="label"
              options={assignableUsers.map((u) => ({
                value: u.id,
                label: `${u.displayName}（${u.username}）`,
              }))}
              notFoundContent={assignableLoading ? '加载中…' : '暂无可指派人员，请先在系统用户中创建物业侧账号'}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Card title="新建工单" className="mt-4 shadow-sm border border-slate-100">
        <Form form={form} layout="vertical" className="max-w-xl" onFinish={createTicket}>
          <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="简要描述问题" allowClear />
          </Form.Item>
          <Form.Item label="描述" name="description" rules={[{ required: true, message: '请输入描述' }]}>
            <Input.TextArea rows={3} placeholder="详细说明、房号、联系方式等" />
          </Form.Item>
          <Button type="primary" htmlType="submit" icon={<PlusOutlined />} className="!bg-[#22c55e] hover:!bg-[#16a34a]">
            创建工单
          </Button>
        </Form>
      </Card>
    </AdminShell>
  )
}
