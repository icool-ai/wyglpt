'use client'

import {
  CheckCircleOutlined,
  DashboardOutlined,
  DollarOutlined,
  FileTextOutlined,
  MobileOutlined,
  RobotOutlined,
  SolutionOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Card, Col, Row, Typography } from 'antd'
import Link from 'next/link'
import { useEffect } from 'react'
import { AdminShell } from '../components/AdminShell'
import { getAccessToken } from '../lib/api'

const modules = [
  {
    href: '/dashboard',
    title: '智慧看板',
    desc: '入住率、工单、营收、设备状态等 KPI 与图表入口',
    icon: <DashboardOutlined className="text-2xl text-[#7c3aed]" />,
  },
  {
    href: '/tickets',
    title: '工单管理',
    desc: '报修、投诉、巡检、派单与状态流转',
    icon: <FileTextOutlined className="text-2xl text-[#7c3aed]" />,
  },
  {
    href: '/owners',
    title: '业主成员',
    desc: '房屋档案、家庭成员、车辆与宠物；支持批量导入导出',
    icon: <TeamOutlined className="text-2xl text-[#7c3aed]" />,
  },
  {
    href: '/billing',
    title: '账单管理',
    desc: '物业费、水电、停车；支付与对账',
    icon: <DollarOutlined className="text-2xl text-[#7c3aed]" />,
  },
  {
    href: '/staff',
    title: '员工管理',
    desc: '物业员工档案、部门岗位、账号与权限入口',
    icon: <SolutionOutlined className="text-2xl text-[#7c3aed]" />,
  },
  {
    href: '/approvals',
    title: '审批中心',
    desc: '账单与高风险操作审批列表',
    icon: <CheckCircleOutlined className="text-2xl text-[#7c3aed]" />,
  },
  {
    href: '/ai-assistant',
    title: 'AI 助手',
    desc: '洞察、派单建议、侧栏快捷入口联动',
    icon: <RobotOutlined className="text-2xl text-[#7c3aed]" />,
  },
  {
    href: '/mobile',
    title: 'H5 移动入口',
    desc: '业主/物业移动端能力预览壳',
    icon: <MobileOutlined className="text-2xl text-[#7c3aed]" />,
  },
]

export default function HomePage() {
  useEffect(() => {
    if (!getAccessToken()) window.location.href = '/login'
  }, [])

  return (
    <AdminShell title="工作台">
      <Row gutter={[16, 16]}>
        {modules.map((m) => (
          <Col xs={24} sm={12} lg={8} key={m.href}>
            <Link href={m.href} className="block h-full cursor-pointer">
              <Card
                hoverable
                className="h-full border-slate-200/80 shadow-sm transition-shadow duration-200 hover:shadow-md"
                styles={{ body: { padding: 20 } }}
              >
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50">
                    {m.icon}
                  </div>
                  <div className="min-w-0">
                    <Typography.Title level={5} className="!mb-1 !mt-0">
                      {m.title}
                    </Typography.Title>
                    <Typography.Paragraph type="secondary" className="!mb-0 text-sm leading-relaxed">
                      {m.desc}
                    </Typography.Paragraph>
                  </div>
                </div>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>
    </AdminShell>
  )
}
