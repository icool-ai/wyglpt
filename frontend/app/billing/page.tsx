'use client'

import { DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import { App, Button, Card, Form, Input, InputNumber, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useState } from 'react'
import { AdminShell } from '../../components/AdminShell'
import { apiFetchJson, getAccessToken, getApiBaseUrl } from '../../lib/api'

type BillRow = {
  id: string
  type: string
  owner: string
  amount: number
  pay: string
  period: string
}

const demoBills: BillRow[] = [
  { id: 'B-8891', type: '物业费', owner: '1-1201 张三', amount: 1280, pay: '已支付', period: '2026-Q1' },
  { id: 'B-8892', type: '水电费', owner: '1-1202 李四', amount: 216.5, pay: '待支付', period: '2026-02' },
  { id: 'B-8893', type: '停车费', owner: '2-0803 王五', amount: 300, pay: '对账中', period: '2026-03' },
]

export default function BillingPage() {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!getAccessToken()) window.location.href = '/login'
  }, [])

  async function createBill(values: { customerName: string; amount: number }) {
    try {
      const data = await apiFetchJson<{ id: string }>(`${getApiBaseUrl()}/billing/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: values.customerName, amount: values.amount }),
      })
      setMsg(`账单创建申请已提交审批：${data.id}`)
      message.success('已提交审批')
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : '提交失败'
      message.error(m)
    }
  }

  const columns: ColumnsType<BillRow> = [
    { title: '单号', dataIndex: 'id', key: 'id', fixed: 'left', width: 100 },
    { title: '类型', dataIndex: 'type', key: 'type' },
    { title: '业主/房号', dataIndex: 'owner', key: 'owner' },
    { title: '账期', dataIndex: 'period', key: 'period', width: 100 },
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
      render: (pay: string) => {
        const color = pay === '已支付' ? 'success' : pay === '待支付' ? 'warning' : 'processing'
        return <Tag color={color}>{pay}</Tag>
      },
    },
  ]

  return (
    <AdminShell title="账单管理">
      <Space direction="vertical" size="large" className="w-full">
        <Card title="新建账单（走审批）" className="shadow-sm border border-slate-100">
          <Form
            form={form}
            layout="vertical"
            className="max-w-xl"
            initialValues={{ amount: 0 }}
            onFinish={(v: { customerName: string; amount: number }) => void createBill(v)}
          >
            <Form.Item
              label="客户名称"
              name="customerName"
              rules={[{ required: true, message: '请输入业主或企业名' }]}
            >
              <Input placeholder="业主或企业名" allowClear />
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
              <Button icon={<UploadOutlined />} disabled>
                批量导入
              </Button>
              <Button icon={<DownloadOutlined />} disabled>
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

        <Card title="账单列表（示意 · 含支付与对账状态）" className="shadow-sm border border-slate-100">
          <Table
            size="middle"
            rowKey="id"
            columns={columns}
            dataSource={demoBills}
            pagination={{ pageSize: 8, showSizeChanger: true }}
            scroll={{ x: 720 }}
          />
        </Card>
      </Space>
    </AdminShell>
  )
}
