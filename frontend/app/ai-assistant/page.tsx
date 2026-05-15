'use client'

import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  RobotOutlined,
  SearchOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { App, Button, Empty, Input, Segmented, Select, Spin, Switch, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AdminShell } from '../../components/AdminShell'
import { apiFetchStream, getAccessToken, getApiBaseUrl, readSseDataLines, type LlmStreamChunk } from '../../lib/api'

type ChatRole = 'user' | 'assistant'
type ConversationMode = 'chat' | 'professional'
type StreamHistoryItem = { role: 'user' | 'assistant'; content: string }

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  reasoning?: string
  mode?: ConversationMode
}

type Conversation = {
  id: string
  title: string
  model: string
  deepThinking: boolean
  mode: ConversationMode
  messages: ChatMessage[]
}

const MODEL_OPTIONS = [
  { label: 'DeepSeek', value: 'deepseek', disabled: false },
  { label: 'Qwen（预留）', value: 'qwen', disabled: true },
  { label: 'OpenAI（预留）', value: 'openai', disabled: true },
]

function cn(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(' ')
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function buildConversationTitle(firstQuestion: string) {
  const text = firstQuestion.trim().replace(/\s+/g, ' ')
  if (!text) return '新对话'
  return text.length > 16 ? `${text.slice(0, 16)}...` : text
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 whitespace-pre-wrap">{children}</p>,
        ul: ({ children }) => <ul className="mb-2 pl-5 list-disc">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 pl-5 list-decimal">{children}</ol>,
        code: ({ className, children }) =>
          className ? (
            <pre className="bg-slate-100 rounded-lg p-2 overflow-auto text-xs">
              <code>{children}</code>
            </pre>
          ) : (
            <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-700">{children}</code>
          ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

export default function AiAssistantPage() {
  const { message } = App.useApp()
  const [queryText, setQueryText] = useState('')
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeId, setActiveId] = useState<string>('')
  const [conversations, setConversations] = useState<Conversation[]>([])

  useEffect(() => {
    if (!getAccessToken()) window.location.href = '/login'
  }, [])

  useEffect(() => {
    if (conversations.length > 0 || activeId) return
    const id = uid()
    setConversations([{ id, title: '新对话', model: 'deepseek', deepThinking: false, mode: 'chat', messages: [] }])
    setActiveId(id)
  }, [activeId, conversations.length])

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeId) ?? null,
    [activeId, conversations],
  )

  const filteredConversations = useMemo(() => {
    const q = queryText.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((item) => item.title.toLowerCase().includes(q))
  }, [conversations, queryText])

  function createConversation() {
    const id = uid()
    const nextConversation: Conversation = {
      id,
      title: '新对话',
      model: 'deepseek',
      deepThinking: false,
      mode: 'chat',
      messages: [],
    }
    setConversations((prev) => [nextConversation, ...prev])
    setActiveId(id)
    setInputText('')
  }

  function updateConversationModel(conversationId: string, model: string) {
    setConversations((prev) => prev.map((item) => (item.id === conversationId ? { ...item, model } : item)))
  }

  function updateDeepThinking(conversationId: string, deepThinking: boolean) {
    setConversations((prev) => prev.map((item) => (item.id === conversationId ? { ...item, deepThinking } : item)))
  }

  function updateConversationMode(conversationId: string, mode: ConversationMode) {
    setConversations((prev) => prev.map((item) => (item.id === conversationId ? { ...item, mode } : item)))
  }

  async function sendMessage() {
    const q = inputText.trim()
    if (!q || loading || !activeConversation) return

    const conversationId = activeConversation.id
    const history: StreamHistoryItem[] = activeConversation.messages
      .filter((x) => (x.role === 'user' || x.role === 'assistant') && x.content.trim())
      .slice(-40)
      .map((x) => ({ role: x.role, content: x.content.trim() }))
    const userMsg: ChatMessage = { id: uid(), role: 'user', content: q }
    const assistantId = uid()

    setInputText('')
    setLoading(true)
    setConversations((prev) =>
      prev.map((item) => {
        if (item.id !== conversationId) return item
        return {
          ...item,
          title: item.messages.length === 0 ? buildConversationTitle(q) : item.title,
          messages: [...item.messages, userMsg, { id: assistantId, role: 'assistant', content: '', mode: item.mode }],
        }
      }),
    )

    try {
      const isProfessional = activeConversation.mode === 'professional'
      const response = await apiFetchStream(isProfessional ? `${getApiBaseUrl()}/ai/ask-stream` : `${getApiBaseUrl()}/ai/chat-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: isProfessional
          ? JSON.stringify({
              question: q,
              thinking: activeConversation.deepThinking,
              showReasoning: activeConversation.deepThinking,
              history,
            })
          : JSON.stringify({ question: q, thinking: activeConversation.deepThinking, history }),
      })

      await readSseDataLines(response, (data) => {
        if ('event' in data && (data as { event?: string }).event === 'error') {
          message.error(String((data as { message?: string }).message ?? '请求失败'))
          return
        }
        if ('event' in data && (data as { event?: string }).event === 'meta') {
          const meta = data as { terminal?: boolean; answer?: string; baseAnswer?: string }
          const fallback =
            typeof meta.answer === 'string' && meta.answer.trim()
              ? meta.answer
              : typeof meta.baseAnswer === 'string' && meta.baseAnswer.trim()
                ? meta.baseAnswer
                : ''
          if (!meta.terminal || !fallback) return
          setConversations((prev) =>
            prev.map((item) => {
              if (item.id !== conversationId) return item
              return {
                ...item,
                messages: item.messages.map((msg) => (msg.id === assistantId ? { ...msg, content: fallback } : msg)),
              }
            }),
          )
          return
        }
        const chunk = data as LlmStreamChunk
        if ('kind' in chunk && chunk.kind === 'content' && chunk.text) {
          setConversations((prev) =>
            prev.map((item) => {
              if (item.id !== conversationId) return item
              return {
                ...item,
                messages: item.messages.map((msg) =>
                  msg.id === assistantId ? { ...msg, content: `${msg.content}${chunk.text}` } : msg,
                ),
              }
            }),
          )
        }
        if ('kind' in chunk && chunk.kind === 'reasoning' && chunk.text) {
          setConversations((prev) =>
            prev.map((item) => {
              if (item.id !== conversationId) return item
              return {
                ...item,
                messages: item.messages.map((msg) =>
                  msg.id === assistantId
                    ? { ...msg, reasoning: `${msg.reasoning ?? ''}${chunk.text}` }
                    : msg,
                ),
              }
            }),
          )
        }
      })
    } catch (e: unknown) {
      setConversations((prev) =>
        prev.map((item) => {
          if (item.id !== conversationId) return item
          return {
            ...item,
            messages: item.messages.map((msg) =>
              msg.id === assistantId ? { ...msg, content: '抱歉，当前请求失败，请稍后重试。' } : msg,
            ),
          }
        }),
      )
      message.error(e instanceof Error ? e.message : '请求失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminShell title="AI 助手" contentClassName="pb-0">
      <div className="h-[calc(100vh-220px)] min-h-[620px] rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex">
        {!sidebarCollapsed ? (
          <aside className="w-[280px] border-r border-slate-200 bg-slate-50/70 flex flex-col">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center justify-between gap-2 mb-3">
                <Typography.Text strong>历史对话</Typography.Text>
                <Button
                  type="text"
                  size="small"
                  icon={<MenuFoldOutlined />}
                  onClick={() => setSidebarCollapsed(true)}
                  aria-label="收起历史对话"
                />
              </div>
              <Button type="primary" block icon={<PlusOutlined />} onClick={createConversation}>
                新增对话
              </Button>
              <Input
                allowClear
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="搜索对话"
                prefix={<SearchOutlined className="text-slate-400" />}
                className="mt-3"
              />
            </div>

            <div className="flex-1 overflow-auto p-2">
              {filteredConversations.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无匹配对话" className="mt-10" />
              ) : (
                filteredConversations.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveId(item.id)}
                    className={cn(
                      'w-full text-left rounded-xl px-3 py-2 mb-2 border transition',
                      activeId === item.id
                        ? 'border-violet-300 bg-violet-50 text-violet-900'
                        : 'border-transparent bg-white hover:border-slate-200 text-slate-700',
                    )}
                  >
                    <div className="text-sm font-medium truncate">{item.title}</div>
                    <div className="text-xs text-slate-400 mt-1">{item.messages.length} 条消息</div>
                  </button>
                ))
              )}
            </div>
          </aside>
        ) : (
          <aside className="w-[56px] border-r border-slate-200 bg-slate-50/70 p-2">
            <Button
              type="text"
              icon={<MenuUnfoldOutlined />}
              onClick={() => setSidebarCollapsed(false)}
              aria-label="展开历史对话"
              className="w-full"
            />
          </aside>
        )}

        <section className="flex-1 flex flex-col">
          <header className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
            <Typography.Text strong>{activeConversation?.title ?? 'AI 助手'}</Typography.Text>
          </header>

          <div className="flex-1 overflow-auto px-6 py-5 bg-slate-50/40">
            {!activeConversation || activeConversation.messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <RobotOutlined className="text-3xl text-violet-500 mb-3" />
                  <Typography.Title level={3} className="!mb-1">
                    你好，我是AI助手
                  </Typography.Title>
                  <Typography.Text type="secondary">你可以开始提问，左侧可管理历史对话。</Typography.Text>
                </div>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-4">
                {activeConversation.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'rounded-2xl px-4 py-3 text-sm leading-7',
                      msg.role === 'user' && 'bg-violet-600 text-white ml-10',
                      msg.role === 'assistant' && 'bg-white border border-slate-200 mr-10 text-slate-800',
                    )}
                  >
                    {msg.role === 'assistant' ? (
                      <div>
                        {msg.reasoning?.trim() ? (
                          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                            <Typography.Text className="block text-xs text-amber-700 mb-1">思考过程</Typography.Text>
                            <div className="text-xs text-amber-900 whitespace-pre-wrap leading-6">
                              {msg.reasoning}
                            </div>
                          </div>
                        ) : null}
                        <MarkdownMessage content={msg.content || (loading ? '正在思考...' : '')} />
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap mb-0">{msg.content}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <footer className="p-4 border-t border-slate-200">
            <div className="max-w-4xl mx-auto">
              <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[auto_auto_1fr] md:items-center">
                  <div className="inline-flex items-center gap-2">
                    <Typography.Text type="secondary" className="text-xs !mb-0 whitespace-nowrap">
                      模式
                    </Typography.Text>
                    <Segmented
                      size="small"
                      value={activeConversation?.mode ?? 'chat'}
                      onChange={(value) =>
                        activeConversation && updateConversationMode(activeConversation.id, value as ConversationMode)
                      }
                      options={[
                        { label: '自由聊天', value: 'chat' },
                        { label: '专业问询', value: 'professional' },
                      ]}
                      className="min-w-[186px]"
                    />
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <Typography.Text type="secondary" className="text-xs !mb-0 whitespace-nowrap">
                      深度思考
                    </Typography.Text>
                    <Switch
                      size="small"
                      checked={Boolean(activeConversation?.deepThinking)}
                      onChange={(checked) => activeConversation && updateDeepThinking(activeConversation.id, checked)}
                    />
                  </div>
                  <div className="inline-flex items-center gap-2 md:justify-end">
                    <Typography.Text type="secondary" className="text-xs !mb-0 whitespace-nowrap">
                      模型
                    </Typography.Text>
                    <Select
                      size="small"
                      value={activeConversation?.model ?? 'deepseek'}
                      onChange={(value) => activeConversation && updateConversationModel(activeConversation.id, value)}
                      options={MODEL_OPTIONS}
                      className="w-full md:w-[210px]"
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <Input.TextArea
                  autoSize={{ minRows: 2, maxRows: 6 }}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault()
                      void sendMessage()
                    }
                  }}
                  placeholder={
                    activeConversation?.mode === 'professional'
                      ? '专业问询模式：将结合数据库内容回答'
                      : '自由聊天模式：输入你的问题'
                  }
                  className="!rounded-xl"
                />
                <Button
                  type="primary"
                  icon={loading ? <Spin size="small" /> : <SendOutlined />}
                  disabled={!inputText.trim() || loading || !activeConversation}
                  onClick={() => void sendMessage()}
                  className="h-[42px] min-w-[92px] rounded-xl"
                >
                  发送
                </Button>
              </div>
            </div>
          </footer>
        </section>
      </div>
    </AdminShell>
  )
}
