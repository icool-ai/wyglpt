<!--
 * @Author: your name
 * @Date: 2026-03-21 00:36:45
 * @LastEditTime: 2026-03-23 21:20:52
 * @LastEditors: your name
 * @Description:
 * @FilePath: \demo\docs\data-dictionary.md
 * 可以输入预定的版权声明、个性签名、空行等
-->

# 数据字典（MVP）

## users / roles

- `roles.code`: 角色编码（`admin`/`finance`/`customer_service`）
- `users.role_code`: 用户角色

## tickets

- `status`: `new`/`assigned`/`in_progress`/`done`/`closed`
- `assignee`: 责任人或班组

## fee_items

- 费用标准项，用于后续账单规则扩展

## bills

- `status`: `draft`/`issued`/`partially_paid`/`paid`/`overdue`
- `amount`: 应收金额

## approval_requests

- `action_type`: 审批动作类型
- `payload_json`: 动作执行参数
- `status`: `pending`/`approved`/`rejected`

## audit_logs（严格审计）

- `masked_input_json`: 脱敏输入
- `diff_json`: 变更前后差异

## notifications

- `channel`: `email`/`in_app`
- `target`: 接收方标识
