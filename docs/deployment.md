# 私有化部署说明（MVP）

## 1. 环境准备
- Docker / Docker Compose
- 可访问的内网域名（可选）
- `.env.example` 复制为 `.env` 并填写真实密钥

## 2. 启动
```bash
docker compose --env-file .env up -d --build
```

## 3. 服务端口
- Frontend: `3000`
- Backend API: `3001`
- MySQL: `3306`

## 4. 审计与日志策略
- 所有 AI 候选动作先入审批单
- 高风险动作审批通过后由执行器落库
- 审计日志必须包含：动作类型、执行者、脱敏输入、变更差异

## 5. 备份与导出
- MySQL 使用定时 `mysqldump`
- 审计日志按月导出（CSV/JSON）
- 审批记录保留不少于 180 天
