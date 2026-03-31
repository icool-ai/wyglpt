'use client'

import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ExportOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { App, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Space, Table, Tag, Typography, Upload } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useState } from 'react'
import { AdminShell } from '../../components/AdminShell'
import {
  apiDownloadBlob,
  apiFetchJson,
  authHeaders,
  getAccessToken,
  getApiBaseUrl,
  triggerBlobDownload,
} from '../../lib/api'

type OwnerRow = {
  id: string
  room: string
  name: string
  memberCount: number
  phone: string
  tags: string[]
}

type OwnerListResponse = {
  items: OwnerRow[]
  total: number
  page: number
  pageSize: number
}

export default function OwnersPage() {
  const { message } = App.useApp()
  const [form] = Form.useForm<{
    room: string
    ownerName: string
    memberCount: number
    phone: string
    tags?: string
  }>()
  const [rows, setRows] = useState<OwnerRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')

  useEffect(() => {
    const id = window.setTimeout(() => {
      const next = searchInput.trim()
      setDebouncedQ((prev) => {
        if (next !== prev) {
          setPage(1)
        }
        return next
      })
    }, 400)
    return () => window.clearTimeout(id)
  }, [searchInput])

  const fetchList = useCallback(
    async (overrides?: { page?: number; pageSize?: number }) => {
      const p = overrides?.page ?? page
      const ps = overrides?.pageSize ?? pageSize
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (debouncedQ) params.set('q', debouncedQ)
        params.set('page', String(p))
        params.set('pageSize', String(ps))
        const data = await apiFetchJson<OwnerListResponse>(`${getApiBaseUrl()}/owners?${params.toString()}`, {
          method: 'GET',
        })
        setRows(data.items)
        setTotal(data.total)
      } catch (e: unknown) {
        message.error(e instanceof Error ? e.message : '加载失败')
      } finally {
        setLoading(false)
      }
    },
    [debouncedQ, page, pageSize, message],
  )

  useEffect(() => {
    if (!getAccessToken()) {
      window.location.href = '/login'
      return
    }
    void fetchList()
  }, [fetchList])

  function openAdd() {
    setEditingId(null)
    form.resetFields()
    form.setFieldsValue({ memberCount: 1 })
    setModalOpen(true)
  }

  function openEdit(record: OwnerRow) {
    setEditingId(record.id)
    form.setFieldsValue({
      room: record.room,
      ownerName: record.name,
      memberCount: record.memberCount,
      phone: record.phone,
      tags: record.tags.length ? record.tags.join(',') : undefined,
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    form.resetFields()
  }

  async function downloadTemplate() {
    try {
      const blob = await apiDownloadBlob(`${getApiBaseUrl()}/owners/import-template`, { method: 'GET' })
      triggerBlobDownload(blob, '业主导入模板.csv')
      message.success('模板已下载')
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '下载失败')
    }
  }

  async function handleImportCsv(file: File) {
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${getApiBaseUrl()}/owners/import`, {
        method: 'POST',
        headers: authHeaders(),
        body: fd,
      })
      const text = await res.text()
      if (!res.ok) {
        let msg = `请求失败 (${res.status})`
        try {
          const j = JSON.parse(text) as { message?: string | string[] }
          if (j.message != null) msg = Array.isArray(j.message) ? j.message.join('；') : String(j.message)
        } catch {
          if (text?.trim()) msg = text.trim().slice(0, 300)
        }
        throw new Error(msg)
      }
      const data = JSON.parse(text) as { created: number; skipped: number; errors: { line: number; message: string }[] }
      const errCount = data.errors?.length ?? 0
      message.success(
        `导入完成：新增 ${data.created} 条，跳过 ${data.skipped} 条（房号已存在）` +
          (errCount ? `，${errCount} 行格式有误未写入` : ''),
      )
      if (errCount && data.errors?.length) {
        message.warning(
          data.errors.slice(0, 3).map((e) => `第${e.line}行：${e.message}`).join('；') +
            (errCount > 3 ? `…等共 ${errCount} 处` : ''),
          6,
        )
      }
      setPage(1)
      await fetchList({ page: 1 })
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '导入失败')
    } finally {
      setImporting(false)
    }
  }

  async function exportData() {
    try {
      const blob = await apiDownloadBlob(`${getApiBaseUrl()}/owners/export`, { method: 'GET' })
      const d = new Date()
      const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      triggerBlobDownload(blob, `业主档案导出_${stamp}.csv`)
      message.success('导出成功')
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '导出失败')
    }
  }

  async function handleSubmit() {
    try {
      const v = await form.validateFields()
      const isEdit = !!editingId
      setSubmitting(true)
      if (editingId) {
        await apiFetchJson(`${getApiBaseUrl()}/owners/${encodeURIComponent(editingId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room: v.room,
            ownerName: v.ownerName,
            memberCount: v.memberCount,
            phone: v.phone,
            tags: v.tags?.trim() || undefined,
          }),
        })
        message.success('已保存')
      } else {
        await apiFetchJson(`${getApiBaseUrl()}/owners`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room: v.room,
            ownerName: v.ownerName,
            memberCount: v.memberCount,
            phone: v.phone,
            tags: v.tags?.trim() || undefined,
          }),
        })
        message.success('已添加')
      }
      closeModal()
      if (!isEdit) {
        setPage(1)
      }
      await fetchList(!isEdit ? { page: 1 } : undefined)
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in e) return
      message.error(e instanceof Error ? e.message : editingId ? '保存失败' : '添加失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiFetchJson(`${getApiBaseUrl()}/owners/${encodeURIComponent(id)}`, { method: 'DELETE' })
      message.success('已删除')
      await fetchList()
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  const columns: ColumnsType<OwnerRow> = [
    { title: '房号', dataIndex: 'room', key: 'room', width: 100, fixed: 'left', className: 'tabular-nums' },
    { title: '业主', dataIndex: 'name', key: 'name', width: 120 },
    {
      title: '在住成员',
      dataIndex: 'memberCount',
      key: 'memberCount',
      width: 110,
      align: 'center',
      render: (n: number) => <span className="tabular-nums">{n}</span>,
    },
    { title: '联系电话', dataIndex: 'phone', key: 'phone', width: 140, className: 'tabular-nums' },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => (
        <Space size={[4, 4]} wrap>
          {tags.map((t) => (
            <Tag key={t} color="purple">
              {t}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} className="!p-0" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除该户档案？" okText="删除" cancelText="取消" onConfirm={() => void handleDelete(record.id)}>
            <Button type="link" danger size="small" icon={<DeleteOutlined />} className="!p-0">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <AdminShell title="业主成员" breadcrumb={[{ title: '住户', href: '/owners' }]}>
      <Space direction="vertical" size="large" className="w-full">
        <Card
          className="shadow-sm border border-slate-100"
          title="业主与家庭成员"
          extra={
            <Space wrap>
              <Button type="primary" icon={<PlusOutlined />} className="!bg-[#7c3aed]" onClick={() => openAdd()}>
                添加
              </Button>
              <Button icon={<DownloadOutlined />} onClick={() => void downloadTemplate()}>
                下载导入模板
              </Button>
              <Button icon={<ExportOutlined />} onClick={() => void exportData()}>
                导出
              </Button>
              <Upload
                accept=".csv,text/csv"
                showUploadList={false}
                beforeUpload={(file) => {
                  void handleImportCsv(file)
                  return false
                }}
              >
                <Button icon={<UploadOutlined />} loading={importing}>
                  批量导入
                </Button>
              </Upload>
            </Space>
          }
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Typography.Paragraph type="secondary" className="!mb-0 text-sm">
              搜索由服务端筛选房号、业主、电话、标签；表格为分页数据。导出仍为全量。
            </Typography.Paragraph>
            <Input
              allowClear
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder="搜索房号、业主、电话、标签…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="max-w-md w-full sm:w-80"
            />
          </div>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={rows}
            loading={loading}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: (t) => `共 ${t} 条`,
              onChange: (p, ps) => {
                setPage(p)
                setPageSize(ps)
              },
            }}
            scroll={{ x: 900 }}
          />
        </Card>
      </Space>

      <Modal
        title={editingId ? '编辑业主户' : '添加业主户'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        okText="保存"
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-2" initialValues={{ memberCount: 1 }}>
          <Form.Item label="房号" name="room" rules={[{ required: true, message: '请输入房号' }]}>
            <Input placeholder="如 1-1201" allowClear />
          </Form.Item>
          <Form.Item label="业主姓名" name="ownerName" rules={[{ required: true, message: '请输入业主姓名' }]}>
            <Input placeholder="业主姓名" allowClear />
          </Form.Item>
          <Form.Item label="在住成员数" name="memberCount" rules={[{ required: true, message: '请输入人数' }]}>
            <InputNumber min={1} className="!w-full" placeholder="含业主本人" />
          </Form.Item>
          <Form.Item label="联系电话" name="phone" rules={[{ required: true, message: '请输入联系电话' }]}>
            <Input placeholder="手机号" allowClear className="tabular-nums" />
          </Form.Item>
          <Form.Item label="标签" name="tags" extra="多个标签可用逗号或分号分隔">
            <Input placeholder="如：自住,已认证" allowClear />
          </Form.Item>
        </Form>
      </Modal>
    </AdminShell>
  )
}
