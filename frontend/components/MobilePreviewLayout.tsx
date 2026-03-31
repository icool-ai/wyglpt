'use client'

import { ArrowLeftOutlined } from '@ant-design/icons'
import { Button, Layout, Typography } from 'antd'
import Link from 'next/link'
import type { ReactNode } from 'react'

const { Content } = Layout

/**
 * H5 入口预览：亲和便民、与 PC 后台分端（design-system/pages/h5.md）
 */
export function MobilePreviewLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-slate-50 py-6 px-4">
      <div className="mx-auto w-full max-w-[420px] rounded-3xl border border-violet-100 bg-white shadow-xl shadow-violet-100/50 overflow-hidden min-h-[640px] flex flex-col">
        <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 bg-white/90">
          <Link href="/">
            <Button type="text" icon={<ArrowLeftOutlined />} size="small" aria-label="返回" />
          </Link>
          <Typography.Title level={5} className="!mb-0 flex-1 text-center pr-8 text-violet-950">
            {title}
          </Typography.Title>
        </header>
        <Content className="flex-1 p-4 bg-[#fafafa]">{children}</Content>
      </div>
      <p className="text-center text-xs text-slate-500 mt-4 max-w-[420px] mx-auto">
        此为桌面端预览壳；正式 H5 可单独路由与打包。
      </p>
    </div>
  )
}
