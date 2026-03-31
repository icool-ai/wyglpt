'use client'

import {
  BellOutlined,
  CreditCardOutlined,
  QrcodeOutlined,
  ToolOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons'
import { Button, Card, List, Tag, Typography } from 'antd'
import Link from 'next/link'
import { MobilePreviewLayout } from '../../components/MobilePreviewLayout'

const ownerActions = [
  { title: '扫码开门', desc: '调起相机或展示动态码', icon: <QrcodeOutlined className="text-xl text-violet-600" /> },
  { title: '在线报修', desc: '上传照片与预约时间', icon: <ToolOutlined className="text-xl text-violet-600" /> },
  { title: '缴费', desc: '物业费、水电、停车', icon: <CreditCardOutlined className="text-xl text-emerald-600" /> },
  { title: '通知公告', desc: '小区事项与停水停电', icon: <BellOutlined className="text-xl text-amber-600" /> },
]

export default function MobilePage() {
  return (
    <MobilePreviewLayout title="智慧物业">
      <Typography.Paragraph type="secondary" className="!text-sm !mb-4">
        业主端：开门、报修、缴费、公告。物业人员额外支持 <Tag color="purple">接单</Tag>。
      </Typography.Paragraph>

      <List
        grid={{ gutter: 12, column: 2 }}
        dataSource={ownerActions}
        renderItem={(item) => (
          <List.Item className="!mb-3">
            <Card
              size="small"
              className="rounded-2xl border-violet-100 shadow-sm cursor-pointer transition-shadow hover:shadow-md"
              styles={{ body: { padding: 14 } }}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  {item.icon}
                  <Typography.Text strong className="text-violet-950">
                    {item.title}
                  </Typography.Text>
                </div>
                <Typography.Text type="secondary" className="!text-xs">
                  {item.desc}
                </Typography.Text>
              </div>
            </Card>
          </List.Item>
        )}
      />

      <Card
        size="small"
        className="rounded-2xl border-emerald-100 bg-emerald-50/40 mt-2"
        title={
          <span className="text-emerald-900">
            <UserSwitchOutlined className="mr-2" />
            物业人员
          </span>
        }
      >
        <Typography.Paragraph className="!mb-3 !text-sm text-emerald-900">
          在业主能力基础上，增加待办接单与处理进度回写，与 PC 后台工单状态同步。
        </Typography.Paragraph>
        <Button type="primary" block className="!bg-[#22c55e] !rounded-xl h-11" disabled>
          进入接单列表（对接 H5 路由后启用）
        </Button>
      </Card>

      <div className="mt-6 text-center">
        <Link href="/">
          <Button type="link" className="text-violet-700">
            返回 PC 工作台
          </Button>
        </Link>
      </div>
    </MobilePreviewLayout>
  )
}
