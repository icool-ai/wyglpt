'use client'

import {
  BellOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  DollarOutlined,
  FileTextOutlined,
  HomeOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MobileOutlined,
  RobotOutlined,
  SearchOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { Avatar, Badge, Breadcrumb, Button, Drawer, Input, Layout, Menu, Space, Typography } from 'antd'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo, useState, type ReactNode } from 'react'

const { Header, Sider, Content } = Layout

type AdminShellProps = {
  title: string
  breadcrumb?: { title: string; href?: string }[]
  children: ReactNode
  /** 主区额外 className（Tailwind） */
  contentClassName?: string
}

const menuItems: MenuProps['items'] = [
  { key: '/', icon: <HomeOutlined />, label: <Link href="/">工作台</Link> },
  { key: '/dashboard', icon: <DashboardOutlined />, label: <Link href="/dashboard">智慧看板</Link> },
  { key: '/tickets', icon: <FileTextOutlined />, label: <Link href="/tickets">工单管理</Link> },
  { key: '/owners', icon: <TeamOutlined />, label: <Link href="/owners">业主成员</Link> },
  { key: '/billing', icon: <DollarOutlined />, label: <Link href="/billing">账单管理</Link> },
  { key: '/staff', icon: <SolutionOutlined />, label: <Link href="/staff">员工管理</Link> },
  { key: '/approvals', icon: <CheckCircleOutlined />, label: <Link href="/approvals">审批中心</Link> },
  { key: '/ai-assistant', icon: <RobotOutlined />, label: <Link href="/ai-assistant">AI 助手</Link> },
  { key: '/mobile', icon: <MobileOutlined />, label: <Link href="/mobile">H5 移动入口</Link> },
]

export function AdminShell({ title, breadcrumb, children, contentClassName = '' }: AdminShellProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiQuery, setAiQuery] = useState('')

  const selectedKeys = useMemo(() => [pathname || '/'], [pathname])

  const bcItems = useMemo(() => {
    const items: { title: string; href?: string }[] = [{ title: '首页', href: '/' }]
    if (breadcrumb?.length) {
      items.push(...breadcrumb.map((b) => ({ title: b.title, href: b.href })))
    }
    items.push({ title })
    return items
  }, [breadcrumb, title])

  function logout() {
    try {
      localStorage.removeItem('accessToken')
    } catch {
      /* ignore */
    }
    // 与登录页成功后的跳转方式一致：整页跳转，避免 App Router 的 router.push 在部分环境下不触发/不刷新状态
    window.location.href = '/login'
  }

  return (
    <Layout className="min-h-screen">
      <Sider
        theme="dark"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={232}
        className="!bg-[#0f172a] border-r border-white/10"
      >
        <div className="flex h-14 items-center gap-2 px-4 border-b border-white/10">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#7c3aed]/30 text-[#e9d5ff]">
            <HomeOutlined />
          </div>
          {!collapsed ? (
            <div>
              <Typography.Text className="!text-white !mb-0 block text-sm font-semibold">
                SmartProperty
              </Typography.Text>
              <Typography.Text type="secondary" className="!text-slate-400 text-xs">
                智慧物业后台
              </Typography.Text>
            </div>
          ) : null}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          items={menuItems}
          className="border-none bg-transparent pt-2"
        />
      </Sider>
      <Layout className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Header className="sticky top-0 z-20 flex min-h-14 flex-nowrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-4 py-2 shadow-sm backdrop-blur md:gap-4 md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? '展开菜单' : '收起菜单'}
              className="shrink-0 text-slate-600"
            />
            <div className="hidden min-w-0 flex-1 sm:block">
              <Input
                allowClear
                prefix={<SearchOutlined className="text-slate-400" />}
                placeholder="搜索工单、房号、业主…"
                className="w-full rounded-lg"
              />
            </div>
          </div>
          <Space size="middle" className="shrink-0">
            <Button
              type="primary"
              ghost
              icon={<RobotOutlined />}
              onClick={() => setAiOpen(true)}
              className="!border-[#7c3aed] !text-[#7c3aed]"
            >
              AI 助手
            </Button>
            <Badge count={3} size="small">
              <Button type="text" icon={<BellOutlined className="text-lg text-slate-600" />} aria-label="消息" />
            </Badge>
            <Space className="cursor-default">
              <Avatar style={{ backgroundColor: '#7c3aed' }} icon={<UserOutlined />} />
              <span className="hidden md:inline text-slate-700 text-sm">管理员</span>
            </Space>
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={logout}
              aria-label="退出登录"
              className="shrink-0 text-slate-600"
            />
          </Space>
        </Header>
        <Content className={`relative z-0 min-h-0 flex-1 p-4 md:p-6 bg-[#f8fafc] ${contentClassName}`}>
          <div className="mb-4 max-w-full">
            <Breadcrumb
              items={bcItems.map((b, i) => ({
                key: i,
                title: b.href ? <Link href={b.href}>{b.title}</Link> : b.title,
              }))}
            />
            <Typography.Title level={3} className="!mb-0 !mt-2 text-slate-900">
              {title}
            </Typography.Title>
            <Typography.Text type="secondary" className="text-sm">
              数据为演示与接口混合展示，便于对齐设计系统与交互稿。
            </Typography.Text>
          </div>
          {children}
        </Content>
      </Layout>

      <Drawer
        title="AI 助手（快捷）"
        placement="right"
        width={400}
        onClose={() => setAiOpen(false)}
        open={aiOpen}
        extra={
          <Link href="/ai-assistant">
            <Button type="link" onClick={() => setAiOpen(false)}>
              进入完整页
            </Button>
          </Link>
        }
      >
        <Typography.Paragraph type="secondary" className="text-sm">
          与设计约定一致：侧栏快捷入口。可在此输入问题，完整能力请使用「AI 助手」页。
        </Typography.Paragraph>
        <Input.TextArea
          rows={4}
          value={aiQuery}
          onChange={(e) => setAiQuery(e.target.value)}
          placeholder="例如：本周收缴率下降原因、待处理工单优先级建议…"
          className="mb-3"
        />
        <Button type="primary" block disabled>
          发送（对接接口后启用）
        </Button>
      </Drawer>
    </Layout>
  )
}
