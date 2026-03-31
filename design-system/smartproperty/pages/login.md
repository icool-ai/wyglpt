# Login Page Overrides

> **PROJECT:** SmartProperty（智慧物业）  
> **Page:** PC 后台 **登录**（`/login`）  
> **Overrides:** `design-system/smartproperty/MASTER.md`；气质与 PC 后台一致时对齐 `pages/pc-admin.md`

本文件规则 **优先于** Master。未列事项遵循 Master（及 pc-admin 通用后台规则）。

---

## 布局

- **桌面（≥900px）：** 双栏 — 左侧 **品牌/产品说明**（深紫渐变 + 浅色网格纹理），右侧 **白底表单卡片**（`max-width: 400px` 量级）。
- **移动：** 单栏堆叠；保证表单区 **无横向滚动**，触控目标 **≥44px**（含主按钮高度）。

## 颜色与组件

- **主色 / 焦点环：** Master Primary `#7C3AED`（输入框 focus、文字链、checkbox accent）。
- **主操作按钮：** Master CTA `#22C55E`（登录提交）；hover 用 **略深绿 + 柔和阴影**，避免 `translateY` 造成 **布局跳动**。
- **错误：** 浅红底 + 红字 + 边框，`role="alert"`，并与相关输入 `aria-invalid` / `aria-describedby` 关联。

## 字体

- **西文 / 数字：** Plus Jakarta Sans（根布局 `next/font`）。
- **中文：** 系统栈（如苹方、微软雅黑）与上述混排，见全局 `styles.css`。

## 表单与无障碍（必做）

- 每个输入 **可见 `<label>` + `htmlFor` / `id`**，**禁止** 仅 placeholder 代替标签。
- 提交时 **loading 文案**（如「登录中…」）+ `aria-busy`；失败时明确错误文案。
- **图标：** 仅装饰用 **SVG** + `aria-hidden`，不把 emoji 当图标。

## 可选行为（产品约定）

- **「在此设备保持登录状态」：** 仅可持久化 **用户名**（localStorage），**不存密码**；取消勾选则清除对应键。
- **「忘记密码」：** 当前为占位入口；接流程后改为跳转工单/联系管理员或重置页。

## 动效

- 过渡 **150–300ms**；遵守 **`prefers-reduced-motion`**。

---

## 实现参考（代码）

- 页面：`frontend/app/login/page.tsx`
- 样式：`frontend/app/login/page.module.css`
