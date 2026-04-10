'use client'

import { BulbOutlined, SendOutlined } from '@ant-design/icons'
import { App, Button, Card, Col, Collapse, Divider, Input, Row, Segmented, Space, Switch, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { AdminShell } from '../../components/AdminShell'
import {
  apiFetchJson,
  apiFetchStream,
  getAccessToken,
  getApiBaseUrl,
  readSseDataLines,
  type LlmStreamChunk,
} from '../../lib/api'

type AskResponse = {
  answer?: string
  insights?: string[]
  recommendations?: string[]
  reasoning?: string
  intent?: string
  total?: number
  page?: number
  pageSize?: number
  items?: unknown[]
  llmUsed?: boolean
  llmNarrativeUsed?: boolean
}

export default function AiAssistantPage() {
  const { message } = App.useApp()
  const [result, setResult] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [thinking, setThinking] = useState(true)
  const [showReasoning, setShowReasoning] = useState(true)
  /** 流式 SSE：chat=仅大模型；askDb=查库后润色；deepagents=LangChain DeepAgents 最小链路 */
  const [streamMode, setStreamMode] = useState(false)
  const [streamKind, setStreamKind] = useState<'chat' | 'askDb' | 'deepagents'>('askDb')
  const [streamReasoning, setStreamReasoning] = useState('')
  const [streamAnswer, setStreamAnswer] = useState('')
  const [streamMeta, setStreamMeta] = useState<Record<string, unknown> | null>(null)
  const [streamToolTrace, setStreamToolTrace] = useState<string[]>([])
  const [streamInsights, setStreamInsights] = useState<string[]>([])
  const [streamRecommendations, setStreamRecommendations] = useState<string[]>([])

  useEffect(() => {
    if (!getAccessToken()) window.location.href = '/login'
  }, [])

  async function askInsight() {
    setLoading(true)
    setResult(null)
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
      setResult(res)
      message.success('已生成洞察')
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '请求失败')
    } finally {
      setLoading(false)
    }
  }

  async function askBillsQuery() {
    const q = prompt.trim()
    if (!q) return

    if (streamMode) {
      await askStream(q)
      return
    }

    setLoading(true)
    setResult(null)
    try {
      const res = await apiFetchJson<AskResponse>(`${getApiBaseUrl()}/ai/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          thinking,
          showReasoning,
        }),
      })
      setResult(res)
      message.success('已生成问答结果')
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '请求失败')
    } finally {
      setLoading(false)
    }
  }

  async function askStream(q: string) {
    setLoading(true)
    setResult(null)
    setStreamReasoning('')
    setStreamAnswer('')
    setStreamMeta(null)
    setStreamToolTrace([])
    setStreamInsights([])
    setStreamRecommendations([])
    const url =
      streamKind === 'askDb'
        ? `${getApiBaseUrl()}/ai/ask-stream`
        : streamKind === 'chat'
          ? `${getApiBaseUrl()}/ai/chat-stream`
          : `${getApiBaseUrl()}/ai/deepagents-stream`
    const body =
      streamKind === 'askDb'
        ? JSON.stringify({ question: q, thinking, showReasoning })
        : JSON.stringify({ question: q, thinking })
    try {
      const res = await apiFetchStream(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      await readSseDataLines(res, (data) => {
        if ('event' in data && (data as { event?: string }).event === 'error') {
          message.error(String((data as { message?: string }).message ?? '流式请求失败'))
          return
        }
        if ('event' in data && (data as { event?: string }).event === 'meta') {
          const m = data as Record<string, unknown>
          setStreamMeta(m)
          if (m.terminal === true) {
            message.info('无法识别业务意图或无需流式润色')
          }
          return
        }
        if ('event' in data && (data as { event?: string }).event === 'extras') {
          const ex = data as { insights?: string[]; recommendations?: string[] }
          if (Array.isArray(ex.insights)) setStreamInsights(ex.insights)
          if (Array.isArray(ex.recommendations)) setStreamRecommendations(ex.recommendations)
          return
        }
        if ('event' in data && (data as { event?: string }).event === 'tool') {
          const t = data as { name?: string; ok?: boolean; args?: Record<string, unknown>; note?: string }
          const name = String(t.name ?? 'unknown_tool')
          const status = t.ok ? 'OK' : 'ERR'
          const argsText = t.args ? JSON.stringify(t.args) : '{}'
          const note = t.note ? ` (${String(t.note)})` : ''
          setStreamToolTrace((arr) => [...arr, `${name} ${status} ${argsText}${note}`])
          return
        }
        const chunk = data as LlmStreamChunk
        if ('kind' in chunk && chunk.kind === 'reasoning' && chunk.text) {
          setStreamReasoning((s) => s + chunk.text)
        }
        if ('kind' in chunk && chunk.kind === 'content' && chunk.text) {
          setStreamAnswer((s) => s + chunk.text)
        }
      })
      message.success('流式输出完成')
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
                <Typography.Text className="text-sm font-medium block mb-2">自定义提问（全局问答）</Typography.Text>
                <Space align="center" className="mb-2" wrap>
                  <Space size={6} align="center">
                    <Switch checked={streamMode} onChange={setStreamMode} />
                    <Typography.Text className="text-xs text-slate-600">流式输出（SSE）</Typography.Text>
                  </Space>
                  <Space size={6} align="center">
                    <Switch checked={thinking} onChange={setThinking} />
                    <Typography.Text className="text-xs text-slate-600">思考模式（deepseek-reasoner）</Typography.Text>
                  </Space>
                  <Space size={6} align="center">
                    <Switch
                      checked={showReasoning}
                      onChange={setShowReasoning}
                      disabled={!thinking || (streamMode && (streamKind === 'chat' || streamKind === 'deepagents'))}
                    />
                    <Typography.Text className="text-xs text-slate-600">展示意图思考（非流式 /ask 或流式查库）</Typography.Text>
                  </Space>
                </Space>
                {streamMode ? (
                  <div className="mb-2">
                    <Typography.Text className="text-xs text-slate-600 block mb-1">流式类型</Typography.Text>
                    <Segmented
                      size="small"
                      block
                      value={streamKind}
                      onChange={(v) => setStreamKind(v as 'chat' | 'askDb' | 'deepagents')}
                      options={[
                        { label: '查库 + 流式润色', value: 'askDb' },
                        { label: '纯对话（不查库）', value: 'chat' },
                        { label: 'DeepAgents（LangChain）', value: 'deepagents' },
                      ]}
                    />
                  </div>
                ) : null}
                <Typography.Paragraph type="secondary" className="!mb-3 text-xs leading-relaxed bg-amber-50/80 border border-amber-100 rounded-lg px-3 py-2">
                  <strong className="text-amber-900">接口区别：</strong>
                  <Typography.Text code>/ai/ask</Typography.Text> 与 <Typography.Text code>/ai/ask-stream</Typography.Text>{' '}
                  都会<strong>查库</strong>；后者在返回真实 <Typography.Text code>items</Typography.Text> 后，用 SSE <strong>流式生成润色正文</strong>。
                  <Typography.Text code>/ai/chat-stream</Typography.Text> 仅对话演示，<strong>不查库</strong>。<Typography.Text code>/ai/deepagents-stream</Typography.Text> 为
                  LangChain DeepAgents 最小链路（支持示例工具调用）。
                </Typography.Paragraph>
                <Input.TextArea
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="例如：有哪些待支付的物业费账单？/有哪些未关闭的工单？/有哪些业主信息？"
                />
                <Button
                  type="default"
                  block
                  className="mt-2"
                  icon={<SendOutlined />}
                  loading={loading}
                  disabled={!prompt.trim()}
                  onClick={() => void askBillsQuery()}
                >
                  {streamMode
                    ? streamKind === 'askDb'
                      ? '发送（查库+流式）'
                      : streamKind === 'chat'
                        ? '发送（纯对话流式）'
                        : '发送（DeepAgents 流式）'
                    : '发送（查询）'}
                </Button>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title="返回结果" className="shadow-sm border border-slate-100 min-h-[360px]">
            {streamMode && (streamMeta || streamReasoning || streamAnswer || loading || streamInsights.length > 0) ? (
              <Space direction="vertical" className="w-full" size="middle">
                <Typography.Text type="secondary" className="text-xs block">
                  当前流式：{' '}
                  <Typography.Text code>
                    {streamKind === 'askDb'
                      ? '/ai/ask-stream'
                      : streamKind === 'chat'
                        ? '/ai/chat-stream'
                        : '/ai/deepagents-stream'}
                  </Typography.Text>
                  {streamKind === 'askDb' ? '（先 meta 含查库结果，再打字润色）' : streamKind === 'chat' ? '（不查库）' : '（LangChain DeepAgents）'}
                </Typography.Text>
                {streamKind === 'askDb' && streamMeta && streamMeta.terminal !== true ? (
                  <div>
                    <Typography.Text className="text-sm font-medium block mb-1">查库结果（meta）</Typography.Text>
                    <Typography.Text type="secondary" className="text-xs block mb-1">
                      {String(streamMeta.intent ?? '') ? `意图：${String(streamMeta.intent)}；` : ''}
                      {typeof streamMeta.total === 'number' ? `共 ${String(streamMeta.total)} 条` : ''}
                    </Typography.Text>
                    {typeof streamMeta.baseAnswer === 'string' ? (
                      <Typography.Paragraph className="text-xs mb-2 bg-white border border-slate-100 rounded p-2 whitespace-pre-wrap">
                        {streamMeta.baseAnswer}
                      </Typography.Paragraph>
                    ) : null}
                    
                  </div>
                ) : null}
                {streamKind === 'askDb' && streamMeta && streamMeta.terminal === true ? (
                  <Typography.Paragraph className="text-sm">{(streamMeta.answer as string) || '（无）'}</Typography.Paragraph>
                ) : null}
                {streamKind === 'deepagents' && streamMeta ? (
                  <Typography.Text type="secondary" className="text-xs block">
                    模型：{String(streamMeta.model ?? '')}
                    {typeof streamMeta.maxToolRounds === 'number' ? `；最大工具轮次：${String(streamMeta.maxToolRounds)}` : ''}
                  </Typography.Text>
                ) : null}
                {streamKind === 'deepagents' && streamToolTrace.length > 0 ? (
                  <div>
                    <Typography.Text className="text-sm font-medium block mb-1">工具调用轨迹</Typography.Text>
                    <pre className="text-xs overflow-auto max-h-[180px] m-0 bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
                      {streamToolTrace.join('\n')}
                    </pre>
                  </div>
                ) : null}
                {thinking && (streamReasoning || (streamKind === 'askDb' && loading)) ? (
                  <div>
                    <Typography.Text className="text-sm font-medium block mb-1">
                      {streamKind === 'askDb' ? '润色过程（推理片段，若有）' : '思考过程（增量）'}
                    </Typography.Text>
                    <div className="text-sm text-slate-700 whitespace-pre-wrap max-h-[280px] overflow-auto rounded-lg border border-amber-100 bg-amber-50/60 p-3">
                      {streamMeta && typeof streamMeta.reasoning === 'string' && streamMeta.reasoning
                        ? `${String(streamMeta.reasoning)}\n`
                        : ''}
                      {streamReasoning || (loading ? '…' : '')}
                      {!streamReasoning && !loading ? '（无）' : null}
                    </div>
                  </div>
                ) : null}
                <div>
                  <Typography.Text className="text-sm font-medium block mb-1">回答（增量）</Typography.Text>
                  <div className="text-sm text-slate-800 whitespace-pre-wrap max-h-[320px] overflow-auto rounded-lg border border-slate-100 bg-slate-50 p-3">
                    {streamAnswer || (loading ? '…' : '（无）')}
                  </div>
                </div>
                {streamKind === 'askDb' && (streamInsights.length > 0 || streamRecommendations.length > 0) ? (
                  <div>
                    {streamInsights.length > 0 ? (
                      <div className="mb-2">
                        <Typography.Text className="text-sm font-medium block mb-1">洞察（extras）</Typography.Text>
                        <ul className="m-0 pl-5">
                          {streamInsights.map((x, idx) => (
                            <li key={idx} className="text-sm">
                              {x}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {streamRecommendations.length > 0 ? (
                      <div>
                        <Typography.Text className="text-sm font-medium block mb-1">建议（extras）</Typography.Text>
                        <ul className="m-0 pl-5">
                          {streamRecommendations.map((x, idx) => (
                            <li key={idx} className="text-sm">
                              {x}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </Space>
            ) : !result ? (
              <Typography.Text type="secondary">点击左侧能力或等待接口返回后在此展示答案/摘要。</Typography.Text>
            ) : (
              (() => {
                const r = result as AskResponse
                const isAskResponse = typeof r?.answer === 'string' || typeof r?.reasoning === 'string'

                if (!isAskResponse) {
                  return (
                    <pre className="text-xs overflow-auto max-h-[480px] m-0 bg-slate-50 p-4 rounded-lg border border-slate-100">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  )
                }

                return (
                  <Space direction="vertical" className="w-full" size="middle">
                    <div>
                      <Typography.Text className="text-xs text-slate-500">
                        {r.intent ? `意图：${r.intent}；` : ''}
                        {typeof r.total === 'number' ? `共 ${r.total} 条；` : ''}
                        {typeof r.page === 'number' ? `第 ${r.page} 页` : ''}
                      </Typography.Text>
                      <Typography.Title level={5} className="!mb-2 mt-2">
                        答案
                      </Typography.Title>
                      <Typography.Paragraph className="mb-0 whitespace-pre-wrap">{r.answer || '（无内容）'}</Typography.Paragraph>
                    </div>

                    {Array.isArray(r.insights) && r.insights.length > 0 ? (
                      <div>
                        <Typography.Text className="text-sm font-medium block mb-1">洞察</Typography.Text>
                        <ul className="m-0 pl-5">
                          {r.insights.map((x, idx) => (
                            <li key={idx} className="text-sm text-slate-700">
                              {x}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {Array.isArray(r.recommendations) && r.recommendations.length > 0 ? (
                      <div>
                        <Typography.Text className="text-sm font-medium block mb-1">建议</Typography.Text>
                        <ul className="m-0 pl-5">
                          {r.recommendations.map((x, idx) => (
                            <li key={idx} className="text-sm text-slate-700">
                              {x}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {typeof r.reasoning === 'string' && r.reasoning.trim().length > 0 ? (
                      <Collapse
                        items={[
                          {
                            key: 'reasoning',
                            label: '思考过程（reasoning_content）',
                            children: (
                              <pre className="text-xs overflow-auto max-h-[360px] m-0 bg-slate-50 p-4 rounded-lg border border-slate-100 whitespace-pre-wrap">
                                {r.reasoning}
                              </pre>
                            ),
                          },
                        ]}
                      />
                    ) : null}

                    <Collapse
                      items={[
                        {
                          key: 'raw',
                          label: '原始 JSON（调试）',
                          children: (
                            <pre className="text-xs overflow-auto max-h-[360px] m-0 bg-slate-50 p-4 rounded-lg border border-slate-100">
                              {JSON.stringify(result, null, 2)}
                            </pre>
                          ),
                        },
                      ]}
                    />
                  </Space>
                )
              })()
            )}
          </Card>
        </Col>
      </Row>
    </AdminShell>
  )
}
