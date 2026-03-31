# 物业智慧平台 - MVP 进度记录

创建时间：2026-03-21

## 已完成（对应最初 Plan 的 to-dos）
1. `scaffold`：完成项目骨架（`backend/`、`frontend/`）、`docker-compose.yml`、基础环境文件与接口文档入口
2. `db-domain`：完成 MySQL 数据结构的初始化脚本与数据字典（`backend/migrations/001_init.sql`、`docs/data-dictionary.md`）
3. `workflow-approvals`：实现工单/账单的“高风险动作审批门控”（派工/关闭/账单生成/催缴/字段覆盖走审批）
4. `ai-candidate-actions`：实现 AI 助手的候选动作生成与“审批后执行”框架，并落到严格审计链路
5. `modules-tickets-billing`：完成工单管理、账单管理的后端 API 与前端页面（含审批列表与执行入口）
6. `dashboard`：完成智慧数据看板接口与前端展示（基于工单/账单统计）
7. `mobile-h5`：完成 H5 移动入口页面（`/mobile`，复用同一套前端能力）
8. `testing-deploy-docs`：补齐最小测试与私有化部署文档（`backend/test/workflow.spec.ts`、`docs/deployment.md`）

## 你新增的改造需求（当前已做 / 待确认）
### 1) TypeORM 实体仓储替换内存态（已完成大部分）
- 已新增/对接实体：
  - `backend/src/entities/ticket.entity.ts`
  - `backend/src/entities/bill.entity.ts`
  - `backend/src/entities/approval-request.entity.ts`
  - `backend/src/entities/audit-log.entity.ts`
  - `backend/src/entities/notification.entity.ts`
  - `backend/src/entities/user.entity.ts`
  - `backend/src/entities/role.entity.ts`
- 已把核心服务从内存数组改为 MySQL 读写（TypeORM 仓储）：
  - `backend/src/modules/tickets/tickets.service.ts`
  - `backend/src/modules/billing/billing.service.ts`
  - `backend/src/modules/approvals/approvals.service.ts`
  - `backend/src/modules/audit/audit.service.ts`
  - `backend/src/modules/notifications/notifications.service.ts`
  - `backend/src/modules/dashboard/dashboard.service.ts`
- 数据库同步开关：`backend/src/modules/app.module.ts` 使用 `TYPEORM_SYNC` 控制

### 2) JWT 登录鉴权（已完成后端+前端改造）
- 后端登录接口：
  - `POST /auth/login`（`backend/src/modules/auth/auth.controller.ts`）
- 后端 JWT：
  - `backend/src/modules/auth/jwt.strategy.ts`
  - `backend/src/modules/auth/jwt-auth.guard.ts`
  - 多个业务控制器已加守卫：`tickets / billing / approvals / dashboard / ai`
- 前端：
  - `frontend/app/login/page.tsx`
  - `frontend/lib/api.ts`（自动附带 `Authorization: Bearer <token>`）
  - 业务页已在无 token 时跳转 `/login`

待你确认点（强烈建议）：
- `backend/src/modules/auth/auth.module.ts` 里是否还需要显式引入 `PassportModule` 以确保 `AuthGuard("jwt")` 正常工作（当前代码已引入 JwtModule，但是否已满足 Passport 初始化要你跑起来验证）。

### 3) 接入真实大模型 API（DeepSeek/千问 OpenAI 兼容）
- 新增 LLM 客户端（OpenAI 兼容 `chat/completions`）：
  - `backend/src/modules/llm/llm.service.ts`
- AiService 已改为真实调用并保留严格 JSON 解析：
  - `backend/src/modules/ai/ai.service.ts`
- 环境变量（你需要在 `.env` 填好）：
  - `LLM_API_KEY`（必填）
  - `LLM_PROVIDER`（`deepseek` 或 `qwen`）
  - `LLM_BASE_URL` / `LLM_MODEL` / `LLM_TEMPERATURE`（可选）

待你确认点：
- 由于不同厂商参数/模型名略有差异，你需要实际调用一次 `/ai/*` 接口确认能稳定返回严格 JSON。

## 还没做/可能需要你补充的内容（不算 bug，但属于下一步）
1. 端到端联调验证：建议你用 Docker Compose 启动后，跑一遍：
   - 登录获取 token
   - 创建工单 -> AI 生成候选 -> 审批 -> 执行落库
   - 创建账单 -> 审批 -> 执行落库 -> 看板统计展示
2. AI 候选动作页面/入口：当前前端主要演示了看板洞察与基础审批流程，`ai/candidate/submit` 仍可能缺少完善的前端入口。
3. `TYPEORM_SYNC`：开发阶段 OK，生产需要关闭并用迁移脚本（目前是 sync + 初始 SQL）。

## 参考位置（快速定位）
- MySQL 初始化脚本：`backend/migrations/001_init.sql`
- 部署文档：`docs/deployment.md`
- 数据字典：`docs/data-dictionary.md`
