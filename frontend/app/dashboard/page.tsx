'use client'

import { FallOutlined, HomeOutlined, RiseOutlined, ToolOutlined } from '@ant-design/icons'
import { Alert, Card, Col, Progress, Row, Spin, Statistic, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useState } from 'react'
import { AdminShell } from '../../components/AdminShell'
import { apiFetchJson, getAccessToken, getApiBaseUrl } from '../../lib/api'

type Overview = {
  occupancyRate?: number
  pendingTickets?: number
  revenueYtd?: number
  revenue?: number
  devicesOnlinePercent?: number
  deviceHealthyPercent?: number
} & Record<string, unknown>

type DeviceRow = { name: string; zone: string; status: '在线' | '告警' | '离线' }

const demoDevices: DeviceRow[] = [
  { name: '门禁 A1', zone: '1 号楼大堂', status: '在线' },
  { name: '电梯监控 B2', zone: '2 号楼', status: '在线' },
  { name: '消防泵房', zone: '地库 B1', status: '告警' },
  { name: '停车场道闸', zone: '东门', status: '在线' },
]

export default function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!getAccessToken()) {
      window.location.href = '/login'
      return
    }
    setLoading(true)
    apiFetchJson<Overview>(`${getApiBaseUrl()}/dashboard/overview`, { method: 'GET' })
      .then((d) => {
        setData(d)
        setErr('')
      })
      .catch((e: Error) => {
        setErr(e.message)
        setData({})
      })
      .finally(() => setLoading(false))
  }, [])

  const occupancy = Number(data?.occupancyRate ?? 0.872)
  const pending = Number(data?.pendingTickets ?? 23)
  const revenue = Number(data?.revenueYtd ?? data?.revenue ?? 1286400)
  const devicePct = Number(data?.devicesOnlinePercent ?? data?.deviceHealthyPercent ?? 0.94)

  const deviceColumns: ColumnsType<DeviceRow> = [
    { title: '设备', dataIndex: 'name', key: 'name' },
    { title: '位置', dataIndex: 'zone', key: 'zone' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: DeviceRow['status']) => (
        <Tag color={s === '在线' ? 'success' : s === '告警' ? 'warning' : 'default'}>{s}</Tag>
      ),
    },
  ]

  return (
    <AdminShell title="智慧数据看板" breadcrumb={[{ title: '运营', href: '/dashboard' }]}>
      {err ? (
        <Alert
          type="warning"
          showIcon
          className="mb-4"
          message="部分数据使用演示值"
          description={`接口暂不可用：${err}`}
        />
      ) : null}

      <Spin spinning={loading}>
        <Row gutter={[16, 16]} className="mb-4">
          <Col xs={24} sm={12} xl={6}>
            <Card bordered={false} className="shadow-sm border border-slate-100">
              <Statistic
                title="入住率（示意）"
                value={occupancy * 100}
                precision={1}
                suffix="%"
                prefix={<HomeOutlined className="text-[#7c3aed]" />}
                valueStyle={{ fontVariantNumeric: 'tabular-nums' }}
              />
              <Progress percent={Math.round(occupancy * 100)} strokeColor="#7c3aed" showInfo={false} className="mt-3" />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card bordered={false} className="shadow-sm border border-slate-100">
              <Statistic
                title="待处理工单"
                value={pending}
                prefix={<ToolOutlined className="text-lg text-amber-500" />}
                valueStyle={{ fontVariantNumeric: 'tabular-nums' }}
              />
              <Typography.Text type="secondary" className="text-xs">
                含报修 / 投诉 / 巡检待分派
              </Typography.Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card bordered={false} className="shadow-sm border border-slate-100">
              <Statistic
                title="本年营收（元）"
                value={revenue}
                prefix={<RiseOutlined className="text-emerald-500" />}
                valueStyle={{ fontVariantNumeric: 'tabular-nums' }}
              />
              <Typography.Text type="secondary" className="text-xs">
                与账单模块联动后可下钻
              </Typography.Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card bordered={false} className="shadow-sm border border-slate-100">
              <Statistic
                title="设备在线率"
                value={devicePct * 100}
                precision={1}
                suffix="%"
                prefix={<FallOutlined className="text-blue-500 rotate-180" />}
                valueStyle={{ fontVariantNumeric: 'tabular-nums' }}
              />
              <Progress
                percent={Math.round(devicePct * 100)}
                strokeColor="#22c55e"
                trailColor="#e2e8f0"
                size="small"
                className="mt-2"
              />
            </Card>
          </Col>
        </Row>

        <Card title="设备状态（示例）" bordered={false} className="shadow-sm border border-slate-100">
          <Table
            size="small"
            pagination={false}
            rowKey="name"
            columns={deviceColumns}
            dataSource={demoDevices}
            scroll={{ x: true }}
          />
        </Card>
      </Spin>
    </AdminShell>
  )
}
