# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/smartproperty/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file (`design-system/smartproperty/MASTER.md`).
> If not, strictly follow the rules below.

---

**Project:** SmartProperty
**Generated:** 2026-03-21 23:00:44
**Category:** Remote Work/Collaboration Tool

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#7C3AED` | `--color-primary` |
| Secondary | `#A78BFA` | `--color-secondary` |
| CTA/Accent | `#22C55E` | `--color-cta` |
| Background | `#FAF5FF` | `--color-background` |
| Text | `#4C1D95` | `--color-text` |

**Color Notes:** Community purple + join green

### Typography

- **Heading Font:** Plus Jakarta Sans
- **Body Font:** Plus Jakarta Sans
- **Mood:** friendly, modern, saas, clean, approachable, professional
- **Google Fonts:** [Plus Jakarta Sans + Plus Jakarta Sans](https://fonts.google.com/share?selection.family=Plus+Jakarta+Sans:wght@300;400;500;600;700)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
```

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #22C55E;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #7C3AED;
  border: 2px solid #7C3AED;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #FAF5FF;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #7C3AED;
  outline: none;
  box-shadow: 0 0 0 3px #7C3AED20;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Soft UI Evolution

**Keywords:** Evolved soft UI, better contrast, modern aesthetics, subtle depth, accessibility-focused, improved shadows, hybrid

**Best For:** Modern enterprise apps, SaaS platforms, health/wellness, modern business tools, professional, hybrid

**Key Effects:** Improved shadows (softer than flat, clearer than neumorphism), modern (200-300ms), focus visible, WCAG AA/AAA

### Page Pattern

**Pattern Name:** Community/Forum Landing

- **Conversion Strategy:** Show active community (member count, posts today). Highlight benefits. Preview content. Easy onboarding.
- **CTA Placement:** Join button prominent + After member showcase
- **Section Order:** 1. Hero (community value prop), 2. Popular topics/categories, 3. Active members showcase, 4. Join CTA

---

## Anti-Patterns (Do NOT Use)

- ❌ Cluttered interface
- ❌ No presence

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile

---

## 产品上下文（智慧物业 PRD 摘要）

- **端划分：** PC 物业管理后台与 H5 **分别设计**（非「一套响应式硬撑两种体验」）。
- **角色：** 当前仅 **管理员**；PC 主要使用者 = **物业管理人员**。
- **H5 用户：** **业主**（开门、报修、缴费、公告）+ **物业人员**（同上 + **接单**）。
- **首页 KPI：** 入住率、待处理工单、营收、设备状态；呈现 = **数据卡片 + 图表 + 数字看板** 混排。
- **业主成员：** 基本信息、家庭成员、车辆、宠物、缴费记录；需 **批量导入/导出**。
- **工单类型：** 报修、投诉、巡检、派单（流程与界面密度见 `pages/pc-admin.md`、`pages/h5.md`）。
- **账单：** 物业费、水电费、停车费等；**在线支付 + 对账**。
- **AI 助手：** 智能客服、自动派单、数据分析等；PC 形态 = **侧边栏/右侧抽屉**。

---

## 工单状态与流程（全局约定）

### 主状态（列表筛选 / 看板列）

1. **待受理** — 已提交，未分配  
2. **已派单 / 待接单** — 已指定执行人；物业 H5「接单」后进入处理中  
3. **处理中** — 已接单，执行中  
4. **待确认** — 处理完成，待业主或管理员确认（可配置是否必须）  
5. **已完成** — 已确认闭环  
6. **已关闭** — 无需继续跟进（如重复单合并、无效说明）  
7. **已取消** — 用户或管理员撤销  
8. **挂起 / 待协调**（可选）— 等配件、等业主时间、等第三方  

**附加维度：** 优先级、SLA 截止时间、当前处理人、超时标记。

### 按类型的流程要点

- **报修：** 提交 → 受理 → 派单/接单 → 处理中 →（可选）待确认 → 已完成/已关闭  
- **投诉：** 提交 → 分级定责 → 调查沟通 → 答复方案 → 结案  
- **巡检：** 计划/路线 → 执行打卡 → 异常生成报修/派单或记台账 → 周期归档  
- **派单（内部）：** 创建 → 指派 → 执行反馈（图文）→ 验收 → 关闭
