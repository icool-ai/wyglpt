import { AntdRegistry } from '@ant-design/nextjs-registry'
import 'antd/dist/reset.css'
import './styles.css'
import type { ReactNode } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { Providers } from './providers'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

/** AntdRegistry 紧贴 body，SSR 注入 css-in-js；hashPriority 减轻与 Tailwind 混用时的覆盖问题 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className={plusJakarta.variable}>
      <body className={plusJakarta.className}>
        <AntdRegistry hashPriority="high">
          <Providers>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  )
}
