# 物业智慧管理平台（MVP）

## 技术栈
- Backend: NestJS + TypeORM + MySQL
- Frontend: Next.js (React) + 响应式 H5
- 部署: Docker Compose（私有化）

## 功能范围
- 工单管理（创建、派工审批、关闭审批）
- 账单管理（创建审批、催缴审批）
- 审批中心（通过后执行动作）
- AI助手（工单分派建议、工单摘要、看板洞察）
- 智慧看板（工单与账单关键指标）

## 快速开始
1. 复制 `.env.example` 为 `.env`
2. 启动：`docker compose --env-file .env up -d --build`
3. 访问：
   - 前端：`http://localhost:3000`
   - 后端文档：`http://localhost:3001/api/docs`

## 目录
- `backend/`: API、审批门控、AI执行器、审计
- `frontend/`: 管理端 + H5入口
- `backend/migrations/`: MySQL初始化SQL
- `docs/`: 数据字典与部署文档
