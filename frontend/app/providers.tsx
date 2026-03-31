'use client'

import { App, ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#7c3aed',
          colorSuccess: '#22c55e',
          colorWarning: '#f59e0b',
          colorError: '#ef4444',
          colorInfo: '#3b82f6',
          borderRadius: 8,
          fontFamily:
            "var(--font-sans), 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif",
        },
        components: {
          Layout: {
            headerBg: '#ffffff',
            bodyBg: '#f8fafc',
            footerBg: '#f8fafc',
          },
          Menu: {
            darkItemBg: 'transparent',
            darkItemSelectedBg: 'rgba(124, 58, 237, 0.35)',
            darkSubMenuItemBg: '#0f172a',
          },
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  )
}
