'use client'

import { BulbOutlined, SendOutlined } from '@ant-design/icons'
import { App, Button, Card, Col, Divider, Input, Row, Space, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { AdminShell } from '../../components/AdminShell'
import { apiFetchJson, getAccessToken, getApiBaseUrl } from '../../lib/api'

export default function AiAssistantPage() {
  const { message } = App.useApp()
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [prompt, setPrompt] = useState('')

  useEffect(() => {
    if (!getAccessToken()) window.location.href = '/login'
  }, [])

  async function askInsight() {
    setLoading(true)
    setResult('')
    try {
      const res = await apiFetchJson<unknown>(`${getApiBaseUrl()}/ai/kpi-insight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric: 'paymentRate',
          current: 0.52,
          previous: 0.63,
        }),
      })
      setResult(JSON.stringify(res, null, 2))
      message.success('已生成洞察')
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '请求失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminShell title="AI 助手" contentClassName="pb-24">
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card
            title={
              <span>
                <BulbOutlined className="mr-2 text-[#7c3aed]" />
                快捷能力
              </span>
            }
            className="shadow-sm border border-slate-100 h-full"
          >
            <Typography.Paragraph type="secondary" className="text-sm">
              设计约定：完整能力在本页；全局顶栏「AI 助手」打开右侧抽屉作快捷入口。
            </Typography.Paragraph>
            <Divider className="my-3" />
            <Space direction="vertical" className="w-full" size="middle">
              <Button type="primary" block loading={loading} onClick={() => void askInsight()}>
                生成收缴率洞察（示例接口）
              </Button>
              <div>
                <Typography.Text className="text-sm font-medium block mb-2">自定义提问（占位）</Typography.Text>
                <Input.TextArea
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="例如：根据本周工单类型分布给出排班建议…"
                />
                <Button
                  type="default"
                  block
                  className="mt-2"
                  icon={<SendOutlined />}
                  disabled
                >
                  发送（对接对话接口后启用）
                </Button>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title="返回结果" className="shadow-sm border border-slate-100 min-h-[360px]">
            {result ? (
              <pre className="text-xs overflow-auto max-h-[480px] m-0 bg-slate-50 p-4 rounded-lg border border-slate-100">
                {result}
              </pre>
            ) : (
              <Typography.Text type="secondary">点击左侧能力或等待接口返回后在此展示 JSON / 摘要。</Typography.Text>
            )}
          </Card>
        </Col>
      </Row>
    </AdminShell>
  )
}
