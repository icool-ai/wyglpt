/** @type {import('next').NextConfig} */
// 须与 Next 监听端口不同；默认后端 3001（见根目录 .env.example）
const backendUrl = process.env.API_PROXY_TARGET || "http://127.0.0.1:3001";

/**
 * Ant Design 5 + Next App Router：若 Webpack 同时打进 cssinjs 的 `es` 与 `lib` 两套副本，
 * 会与 antd 内置样式上下文不一致，出现首屏无样式/闪烁。统一 alias 到 `lib`。
 * @see https://github.com/ant-design/ant-design/issues/45567
 */
const nextConfig = {
  reactStrictMode: true,
  /** 开发环境 rewrites 走代理时，默认超时较短；/ai/ask 等 LLM 请求可能超过 30s，导致 socket hang up（ECONNRESET） */
  experimental: {
    proxyTimeout: Number(process.env.API_PROXY_TIMEOUT_MS || 300000),
  },
  transpilePackages: [
    "antd",
    "@ant-design/icons",
    "@ant-design/cssinjs",
    "@ant-design/nextjs-registry",
  ],
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@ant-design/cssinjs": require.resolve("@ant-design/cssinjs/lib"),
    };
    return config;
  },
  async rewrites() {
    return [{ source: "/api-backend/:path*", destination: `${backendUrl}/:path*` }];
  },
};

module.exports = nextConfig;
