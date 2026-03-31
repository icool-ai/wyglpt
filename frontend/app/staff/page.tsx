'use client'

import { PlusOutlined } from '@ant-design/icons'
import { Button, Card, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect } from 'react'
import { AdminShell } from '../../components/AdminShell'
import { getAccessToken } from '../../lib/api'

type StaffRow = {
  key: string
  name: string
  dept: string
  role: string
  phone: string
  status: '在职' | '停用'
}

const demoRows: StaffRow[] = [
  { key: '1', name: '赵敏', dept: '管理处', role: '项目经理', phone: '138****1001', status: '在职' },
  { key: '2', name: '钱伟', dept: '工程部', role: '维修主管', phone: '139****2002', status: '在职' },
  { key: '3', name: '孙丽', dept: '客服中心', role: '前台', phone: '136****3003', status: '在职' },
  { key: '4', name: '周强', dept: '秩序部', role: '班长', phone: '135****4004', status: '停用' },
]

export default function StaffPage() {
  useEffect(() => {
    if (!getAccessToken()) window.location.href = '/login'
  }, [])

  const columns: ColumnsType<StaffRow> = [
    { title: '姓名', dataIndex: 'name', key: 'name', width: 120, fixed: 'left' },
    { title: '部门', dataIndex: 'dept', key: 'dept', width: 140 },
    { title: '岗位', dataIndex: 'role', key: 'role', width: 140 },
    { title: '手机', dataIndex: 'phone', key: 'phone', width: 140, className: 'tabular-nums' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: StaffRow['status']) => (
        <Tag color={s === '在职' ? 'success' : 'default'}>{s}</Tag>
      ),
    },
  ]

  return (
    <AdminShell title="员工管理" breadcrumb={[{ title: '人事', href: '/staff' }]}>
      <Space direction="vertical" size="large" className="w-full">
        <Card
          className="shadow-sm border border-slate-100"
          title="物业员工"
          extra={
            <Button type="primary" icon={<PlusOutlined />} disabled className="!bg-[#7c3aed]">
              新建员工
            </Button>
          }
        >
          <Typography.Paragraph type="secondary" className="!mb-4 text-sm">
            员工档案、部门岗位与后台账号权限将在此统一管理；新建与接口对接后启用。下表为演示数据。
          </Typography.Paragraph>
          <Table
            rowKey="key"
            columns={columns}
            dataSource={demoRows}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            scroll={{ x: 640 }}
          />
        </Card>
      </Space>
    </AdminShell>
  )
}
