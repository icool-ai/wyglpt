'use client'

import { DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import { App, Button, Card, ConfigProvider, DatePicker, Form, Input, InputNumber, Select, Space, Table, Tag, Typography, Upload } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import zhCN from 'antd/locale/zh_CN'
import { AdminShell } from '../../components/AdminShell'
import { apiDownloadBlob, apiFetchJson, authHeaders, getAccessToken, getApiBaseUrl, triggerBlobDownload } from '../../lib/api'

type BillRow = {
  id: string
  type: string
  owner: string
  amount: number
  pay: string
  periodStart: string
  periodEnd: string
}

export default function BillingPage() {
  const { message } = App.useApp()
  const [createForm] = Form.useForm<{
    type: string
    owner: string
    periodStart: any
    periodEnd: any
    amount: number
  }>()
  const [queryForm] = Form.useForm<{
    id?: string
    type?: string
    owner?: string
    periodStart?: any
    periodEnd?: any
    amountMin?: number
    amountMax?: number
    pay?: string
  }>()
  const [msg, setMsg] = useState('')

  const [rows, setRows] = useState<BillRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)

  const [importing, setImporting] = useState(false)
  const [filters, setFilters] = useState<{
    id?: string
    type?: string
    owner?: string
    periodStart?: string
    periodEnd?: string
    amountMin?: number
    amountMax?: number
    pay?: string
  }>({})

  useEffect(() => {
    if (!getAccessToken()) window.location.href = '/login'
  }, [])

  const payColor = useCallback((pay: string) => {
    if (pay === '已支付') return 'success'
    if (pay === '待支付') return 'warning'
    if (pay === '对账中') return 'processing'
    if (pay === '逾期') return 'error'
    return 'processing'
  }, [])

  const fetchList = useCallback(
    async (overrides?: { page?: number; pageSize?: number; nextFilters?: typeof filters }) => {
      const nextPage = overrides?.page ?? page
      const nextPageSize = overrides?.pageSize ?? pageSize
      const nextFilters = overrides?.nextFilters ?? filters

      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (nextFilters.id) params.set('id', nextFilters.id)
        if (nextFilters.type) params.set('type', nextFilters.type)
        if (nextFilters.owner) params.set('owner', nextFilters.owner)
        if (nextFilters.periodStart) params.set('periodStart', nextFilters.periodStart)
        if (nextFilters.periodEnd) params.set('periodEnd', nextFilters.periodEnd)
        if (nextFilters.amountMin != null) params.set('amountMin', String(nextFilters.amountMin))
        if (nextFilters.amountMax != null) params.set('amountMax', String(nextFilters.amountMax))
        if (nextFilters.pay) params.set('pay', nextFilters.pay)
        params.set('page', String(nextPage))
        params.set('pageSize', String(nextPageSize))

        const data = await apiFetchJson<{ items: BillRow[]; total: number; page: number; pageSize: number }>(
          `${getApiBaseUrl()}/billing/bills/query?${params.toString()}`,
          { method: 'GET' },
        )
        setRows(data.items)
        setTotal(data.total)
        setPage(data.page)
        setPageSize(data.pageSize)
      } catch (e: unknown) {
        message.error(e instanceof Error ? e.message : '加载失败')
      } finally {
        setLoading(false)
      }
    },
    [filters, message, page, pageSize],
  )

  useEffect(() => {
    void fetchList({ page: 1 })
  }, [fetchList])

  async function createBill(values: {
    type: string
    owner: string
    periodStart: any
    periodEnd: any
    amount: number
  }) {
    try {
      const periodStart = values.periodStart ? dayjs(values.periodStart).format('YYYY-MM-DD') : ''
      const periodEnd = values.periodEnd ? dayjs(values.periodEnd).format('YYYY-MM-DD') : ''
      const data = await apiFetchJson<{ id: string }>(`${getApiBaseUrl()}/billing/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, periodStart, periodEnd }),
      })
      setMsg(`账单创建申请已提交审批：${data.id}`)
      message.success('已提交审批')
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : '提交失败'
      message.error(m)
    }
  }

  async function downloadTemplate() {
    try {
      const blob = await apiDownloadBlob(`${getApiBaseUrl()}/billing/bills/import-template`, { method: 'GET' })
      triggerBlobDownload(blob, '账单导入模板.csv')
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
      const res = await fetch(`${getApiBaseUrl()}/billing/bills/import`, {
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
      const data = JSON.parse(text) as {
        id: string
        created: number
        skipped: number
        errors: { line: number; message: string }[]
      }
      setMsg(`账单批量导入申请已提交审批：${data.id}`)
      message.success(`已提交审批：新增 ${data.created} 条，跳过 ${data.skipped} 条`)
      if (data.errors?.length) {
        message.warning(
          data.errors
            .slice(0, 3)
            .map((e) => `第${e.line}行：${e.message}`)
            .join('；') + (data.errors.length > 3 ? `…等共 ${data.errors.length} 处` : ''),
        )
      }
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '导入失败')
    } finally {
      setImporting(false)
    }
  }

  async function exportData() {
    try {
      const blob = await apiDownloadBlob(`${getApiBaseUrl()}/billing/bills/export`, { method: 'GET' })
      triggerBlobDownload(blob, `账单对账导出.csv`)
      message.success('导出成功')
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '导出失败')
    }
  }

  const columns: ColumnsType<BillRow> = useMemo(
    () => [
      { title: '单号', dataIndex: 'id', key: 'id', fixed: 'left', width: 120 },
      { title: '类型', dataIndex: 'type', key: 'type', width: 120 },
      { title: '业主/房号', dataIndex: 'owner', key: 'owner', width: 200 },
      { title: '账期开始', dataIndex: 'periodStart', key: 'periodStart', width: 150 },
      { title: '账期结束', dataIndex: 'periodEnd', key: 'periodEnd', width: 150 },
      {
        title: '金额',
        dataIndex: 'amount',
        key: 'amount',
        align: 'right',
        render: (a: number) => <span className="tabular-nums">¥ {a.toLocaleString('zh-CN')}</span>,
      },
      {
        title: '支付/对账',
        dataIndex: 'pay',
        key: 'pay',
        width: 130,
        render: (pay: string) => <Tag color={payColor(pay)}>{pay}</Tag>,
      },
    ],
    [payColor],
  )

  return (
    <ConfigProvider locale={zhCN}>
      <AdminShell title="账单管理">
        <Space direction="vertical" size="large" className="w-full">
        <Card title="新建账单（走审批）" className="shadow-sm border border-slate-100">
          <Form
            form={createForm}
            layout="vertical"
            className="max-w-xl"
            initialValues={{ amount: 0 }}
            onFinish={(v) => void createBill(v)}
          >
            <Form.Item
              label="账单类型"
              name="type"
              rules={[{ required: true, message: '请输入账单类型' }]}
            >
              <Select placeholder="请选择账单类型" allowClear>
                <Select.Option value="物业费">物业费</Select.Option>
                <Select.Option value="水电费">水电费</Select.Option>
                <Select.Option value="停车费">停车费</Select.Option>
                <Select.Option value="其他">其他</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item label="业主/房号" name="owner" rules={[{ required: true, message: '请输入业主或房号' }]}>
              <Input placeholder="如 1-1201 张三" allowClear />
            </Form.Item>

            <Form.Item label="账期开始" name="periodStart" rules={[{ required: true, message: '请选择账期开始（日度）' }]}>
              <DatePicker picker="date" format="YYYY-MM-DD" style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item label="账期结束" name="periodEnd" rules={[{ required: true, message: '请选择账期结束（日度）' }]}>
              <DatePicker picker="date" format="YYYY-MM-DD" style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              label="金额（元）"
              name="amount"
              rules={[{ required: true, message: '请输入金额' }]}
            >
              <InputNumber min={0} step={0.01} className="!w-full" placeholder="0.00" />
            </Form.Item>
            <Space wrap className="w-full">
              <Button type="primary" htmlType="submit" className="!bg-[#22c55e] hover:!bg-[#16a34a]">
                提交账单审批
              </Button>
              <Button icon={<DownloadOutlined />} onClick={() => void downloadTemplate()}>
                下载导入模板
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
              <Button icon={<DownloadOutlined />} onClick={() => void exportData()}>
                导出对账
              </Button>
            </Space>
            {msg ? (
              <Typography.Paragraph type="secondary" className="!mb-0 !mt-3">
                {msg}
              </Typography.Paragraph>
            ) : null}
          </Form>
        </Card>

        <Card title="账单列表（可查询 + 含支付与对账状态）" className="shadow-sm border border-slate-100">
          <Form
            form={queryForm}
            layout="inline"
            onFinish={(v) => {
              setPage(1)
              setFilters({
                id: v.id?.trim() || undefined,
                type: v.type?.trim() || undefined,
                owner: v.owner?.trim() || undefined,
                periodStart: v.periodStart ? dayjs(v.periodStart).format("YYYY-MM-DD") : undefined,
                periodEnd: v.periodEnd ? dayjs(v.periodEnd).format("YYYY-MM-DD") : undefined,
                amountMin: v.amountMin,
                amountMax: v.amountMax,
                pay: v.pay?.trim() || undefined,
              })
            }}
          >
            <Space wrap className="w-full">
              <Form.Item name="id" label="单号">
                <Input allowClear placeholder="支持关键词" style={{ width: 150 }} />
              </Form.Item>
              <Form.Item name="type" label="类型">
                <Input allowClear placeholder="如 物业费" style={{ width: 150 }} />
              </Form.Item>
              <Form.Item name="owner" label="业主/房号">
                <Input allowClear placeholder="如 1-1201 张三" style={{ width: 220 }} />
              </Form.Item>
              <Form.Item name="periodStart" label="账期开始">
                <DatePicker picker="date" format="YYYY-MM-DD" allowClear />
              </Form.Item>

              <Form.Item name="periodEnd" label="账期结束">
                <DatePicker picker="date" format="YYYY-MM-DD" allowClear />
              </Form.Item>
              <Form.Item name="amountMin" label="金额(最小)">
                <InputNumber min={0} step={0.01} style={{ width: 140 }} placeholder="0.00" />
              </Form.Item>
              <Form.Item name="amountMax" label="金额(最大)">
                <InputNumber min={0} step={0.01} style={{ width: 140 }} placeholder="0.00" />
              </Form.Item>
              <Form.Item name="pay" label="支付/对账">
                <Select allowClear style={{ width: 150 }} placeholder="全部">
                  <Select.Option value="已支付">已支付</Select.Option>
                  <Select.Option value="待支付">待支付</Select.Option>
                  <Select.Option value="对账中">对账中</Select.Option>
                  <Select.Option value="逾期">逾期</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" className="!bg-[#7c3aed] hover:!bg-[#6d28d9]">
                  查询
                </Button>
              </Form.Item>
              <Form.Item>
                <Button
                  htmlType="button"
                  onClick={() => {
                    queryForm.resetFields()
                    setFilters({})
                    setPage(1)
                  }}
                >
                  重置
                </Button>
              </Form.Item>
            </Space>
          </Form>
          <Table
            size="middle"
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
                void fetchList({ page: p, pageSize: ps })
              },
            }}
            scroll={{ x: 980 }}
          />
        </Card>
        </Space>
      </AdminShell>
    </ConfigProvider>
  )
}
