'use client'

import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { Alert, Button, Form, Input } from 'antd'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { apiFetchJson, getApiBaseUrl, type ApiRequestError } from '../../lib/api'

function IconBuilding(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden {...props}>
      <path d="M4 21V8l8-4 8 4v13" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 21v-6h6v6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 9h.01M12 9h.01M15 9h.01" strokeLinecap="round" />
    </svg>
  )
}

function IconCheck(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden {...props}>
      <path d="M5 12l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const REMEMBER_KEY = 'sp_login_remember'
const USERNAME_KEY = 'sp_login_username'

function loginErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return '登录失败'
  const e = err as ApiRequestError
  if (typeof e.status === 'number' && e.status === 401) {
    return e.message || '账号或者密码错误'
  }
  return e.message
}

export default function LoginPage() {
  const [form] = Form.useForm<{ username: string; password: string }>()
  const [rememberDevice, setRememberDevice] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    try {
      const r = localStorage.getItem(REMEMBER_KEY)
      const u = localStorage.getItem(USERNAME_KEY)
      if (r === '1' && u) {
        setRememberDevice(true)
        form.setFieldsValue({ username: u, password: '' })
      } else {
        setRememberDevice(false)
        form.setFieldsValue({ username: 'admin', password: 'admin123' })
      }
    } catch {
      setRememberDevice(false)
      form.setFieldsValue({ username: 'admin', password: 'admin123' })
    }
  }, [form])

  async function onFinish(values: { username: string; password: string }) {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetchJson<{ accessToken: string }>(
        `${getApiBaseUrl()}/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: values.username, password: values.password }),
        },
      )
      localStorage.setItem('accessToken', res.accessToken)
      try {
        if (rememberDevice) {
          localStorage.setItem(REMEMBER_KEY, '1')
          localStorage.setItem(USERNAME_KEY, values.username.trim())
        } else {
          localStorage.removeItem(REMEMBER_KEY)
          localStorage.removeItem(USERNAME_KEY)
        }
      } catch {
        /* ignore */
      }
      window.location.href = '/'
    } catch (e: unknown) {
      setError(loginErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] grid grid-cols-1 bg-slate-50 min-[900px]:grid-cols-[minmax(320px,1fr)_minmax(400px,520px)]">
      <aside
        className="relative flex flex-col justify-center overflow-hidden px-8 py-12 text-slate-50 min-[900px]:px-14 min-[900px]:py-16"
        style={{
          background: 'linear-gradient(145deg, #1e1b4b 0%, #4c1d95 42%, #5b21b6 100%)',
        }}
        aria-label="产品说明"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-100"
          style={{
            backgroundImage: `
              linear-gradient(rgba(248, 250, 252, 0.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(248, 250, 252, 0.04) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }}
        />
        <div className="relative z-[1] mx-auto w-full max-w-md">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[0.8125rem] font-medium tracking-wide">
            <IconBuilding />
            <span>SmartProperty 智慧物业</span>
          </div>
          <h1 className="mt-5 text-[clamp(1.75rem,3vw,2.25rem)] font-bold leading-tight tracking-tight">物业管理后台</h1>
          <p className="mt-2 text-base leading-relaxed text-slate-50/80">
            统一工单、账单、设备与数据看板，为管理处提供可信赖的数字化运营入口。
          </p>
          <ul className="mt-7 flex list-none flex-col gap-3 p-0">
            <li className="flex items-center gap-2.5 text-[0.9375rem] text-slate-50/90">
              <IconCheck className="shrink-0 opacity-90" />
              多维度运营指标与安全登录
            </li>
            <li className="flex items-center gap-2.5 text-[0.9375rem] text-slate-50/90">
              <IconCheck className="shrink-0 opacity-90" />
              工单与账单流程可追溯
            </li>
            <li className="flex items-center gap-2.5 text-[0.9375rem] text-slate-50/90">
              <IconCheck className="shrink-0 opacity-90" />
              支持后续角色权限扩展
            </li>
          </ul>
        </div>
      </aside>

      <div className="relative z-10 flex items-center justify-center px-6 py-10 min-[900px]:px-12 min-[900px]:py-14">
        <div className="relative z-10 w-full max-w-[400px] rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_12px_40px_rgba(15,23,42,0.08)] min-[900px]:p-9">
          <header className="mb-6">
            <p className="mb-1 text-[0.8125rem] font-semibold uppercase tracking-[0.06em] text-[#7c3aed]">管理员登录</p>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">欢迎回来</h2>
            <p className="mt-2 text-[0.9375rem] leading-normal text-slate-600">
              请使用物业后台账号登录。若忘记密码，请联系系统管理员。
            </p>
          </header>

          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            className="!mt-1"
            onFinish={(v) => void onFinish(v)}
            onValuesChange={() => setError('')}
          >
            <Form.Item
              label="用户名"
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input prefix={<UserOutlined className="text-slate-400" />} placeholder="请输入用户名" size="large" autoComplete="username" />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password prefix={<LockOutlined className="text-slate-400" />} placeholder="请输入密码" size="large" autoComplete="current-password" />
            </Form.Item>

            <div className="relative z-[2] mb-4 flex flex-wrap items-center justify-between gap-3">
              <label className="flex max-w-[calc(100%-5rem)] cursor-pointer items-start gap-2.5 text-sm leading-snug text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.currentTarget.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 accent-violet-600"
                />
                <span className="select-none">在此设备保持登录状态</span>
              </label>
              <Button type="link" className="!h-auto shrink-0 !p-0" disabled>
                忘记密码
              </Button>
            </div>

            {error ? (
              <Alert type="error" showIcon message={error} className="mb-4" role="alert" />
            ) : null}
            <Form.Item className="!mb-0">
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
                className="!h-11 !bg-[#22c55e] !font-semibold hover:!bg-[#16a34a]"
              >
                登录
              </Button>
            </Form.Item>
          </Form>

          <footer className="mt-6 border-t border-slate-200 pt-5 text-center">
            <Link href="/" className="text-sm text-slate-500 transition-colors hover:text-[#7c3aed]">
              返回平台首页
            </Link>
          </footer>
        </div>
      </div>
    </div>
  )
}
