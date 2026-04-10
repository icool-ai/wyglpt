import { NextResponse } from 'next/server'

/** GET：浏览器打开 /auth/login 时跳到真实登录页 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  return NextResponse.redirect(new URL('/login', url.origin))
}

/**
 * POST 到本站 /auth/login 会变成 HTML/307，触发前端 JSON 解析失败。
 * 明确返回 JSON，提示应走 /api-backend 代理到 Nest。
 */
export async function POST() {
  return NextResponse.json(
    {
      message:
        '请求发到了 Next 页面地址。请设置 NEXT_PUBLIC_API_BASE_URL=/api-backend，并用 npm run dev（默认端口 3000）且后端运行在 3001。',
    },
    { status: 404 },
  )
}
