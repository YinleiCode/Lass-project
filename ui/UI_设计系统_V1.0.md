# 颂恩艺术 · UI 设计系统 V1.0

> 本文档是 UI 实施的**唯一标准**。所有页面、组件、样式必须严格遵守此规范。
> 配套高保真原型在 `/ui/` 目录(8 个 HTML 文件),可作为视觉参考。
> 目标:把 15 个已实现的页面,从默认样式改造为**雾霾蓝 + 手绘点缀**的设计系统。

---

## 0. 给 Claude Code 的执行指令

### 工作流程(请严格按顺序)

```
第 1 步:在 app.wxss 中实施"全局设计令牌"(本文第 1-5 节)
第 2 步:改造 custom-tab-bar 组件(第 6 节)
第 3 步:按页面优先级逐个改造样式:
   ⓵ teacher/home(老师端首页)— 定调基准页
   ⓶ parent/home(家长端首页)— 给客户看的脸
   ⓷ teacher/students(学员列表 + 详情 + 新增)
   ⓸ teacher/calendar(课表)
   ⓹ teacher/checkin(点名)
   ⓺ teacher/feedback(反馈)
   ⓻ teacher/payment(缴费登记)
   ⓼ teacher/profile(老师我的)
   ⓽ parent/records(上课记录)
   ⓾ parent/feedback-detail(反馈详情)
   ⑪ parent/payment-list(缴费记录)
   ⑫ parent/leave(请假)
   ⑬ parent/profile(家长我的)
   ⑭ common/identity(身份选择)
   ⑮ common/bindparent(家长绑定)

第 4 步:全局一致性检查(本文第 11 节)
```

### 重要原则

1. **不改 wxml 结构,只改 wxss 样式**(除非样式无法只用 CSS 实现)
2. **不改 JS 逻辑**(本次仅 UI 改造)
3. **每改完一个页面,立刻让用户预览确认**,再改下一个
4. **遇到无法用 CSS 解决的样式问题,先问用户**,不要擅自改 wxml

---

## 1. 设计调性

**核心关键词**:雾霾蓝 · 东京设计感 · 冷调清静 · 手绘点缀

**追求的气质**:
- ✅ Notion / Linear 那种克制的高端工具感
- ✅ 杂志编辑感(衬线字体 + 等宽英文标签)
- ✅ 暖色点缀(手写体 slogan、警告色)避免完全冷漠

**避免的设计**:
- ❌ 鲜艳卡通(像猿辅导、作业帮)
- ❌ 冰冷商务(像钉钉、企业微信)
- ❌ 通用 Material / iOS 模板感
- ❌ AI 模板的"安全好看"

---

## 2. 色板(必须 100% 遵守)

### 2.1 全局色板 → 写入 app.wxss

```css
/* app.wxss 顶部 */
page {
  /* === 背景层 === */
  --paper:        #F4F7FA;   /* 主背景 - 雾霾蓝白 */
  --paper-warm:   #E8EFF5;   /* 次背景 - 浅雾蓝 */
  --cream:        #FFFFFF;   /* 卡片白 */
  --line:         #DDE5ED;   /* 分割线 */
  --line-soft:    #EAF0F5;   /* 浅分割线 */

  /* === 文字层 === */
  --ink:          #2A3744;   /* 主文字 - 深蓝墨 */
  --ink-soft:     #5A6B7E;   /* 次文字 - 雾蓝灰 */
  --ink-mute:     #93A3B5;   /* 弱文字 - 浅蓝灰 */

  /* === 主色(强调色)=== */
  --accent:       #2C5282;   /* 主色 - 深沉蓝 */
  --accent-mid:   #6B91B8;   /* 主色中 - 雾霾蓝 */
  --accent-soft:  #BFD1E5;   /* 主色浅 */
  --accent-bg:    #EDF3F9;   /* 主色超浅背景 */

  /* === 警告/状态色(故意保留暖色)=== */
  --warn:         #EA580C;   /* 警告橙 */
  --warn-bg:      #FFF4E6;   /* 警告浅橙 */
  --warn-soft:    #FED7AA;   /* 警告中橙 */
  --warn-border:  #FDBA74;   /* 警告边框 */
  --warn-text:    #7C2D12;   /* 警告深棕 */

  /* === 成功 === */
  --green:        #4D7C0F;
  --green-bg:     #ECFCCB;

  /* === 错误/缺勤 === */
  --red:          #B91C1C;
  --red-bg:       #FEE2E2;

  background: var(--paper);
}
```

### 2.2 为什么保留橙色?(重要设计决策)

**冷色不擅长警示**——纯蓝色界面里的"红蓝"警告会让用户误以为是普通信息。
我们在这些地方**必须保留橙色**:

| 使用场景 | 颜色 |
|---------|------|
| 续费提醒卡片背景 | `linear-gradient(135deg, #FFF4E6 0%, #FED7AA 100%)` |
| 续费提醒边框 | `#FDBA74` |
| "需续费"徽章背景 | `#EA580C` |
| 课时不足的剩余数字 | `#EA580C` |
| 提醒图标 | `#EA580C` |

**其他地方一律用蓝色调**。

---

## 3. 字体(微信小程序兼容方案)

### 3.1 字体变量 → 写入 app.wxss

⚠️ **关键**:微信小程序**不支持 Google Fonts 在线加载**。
设计稿用的字体在小程序里必须**回退到系统字体**。

```css
/* app.wxss 顶部,接续上面 page {} */
page {
  /* ... 上面的色板变量 ... */
  
  /* === 字体 === */
  --font-serif:  STSong, "Songti SC", SimSun, serif;
  --font-sans:   -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
  --font-script: STKaiti, KaiTi, "楷体", cursive;
  --font-num:    Georgia, "Times New Roman", serif;
  --font-mono:   "SF Mono", Menlo, Consolas, monospace;
  
  font-family: var(--font-sans);
  color: var(--ink);
}
```

### 3.2 字体使用规则

| 元素 | 字体 | 说明 |
|------|------|------|
| 页面主标题(brand-name、greeting-line、section-title) | `var(--font-serif)` | 思源宋体替代,有书卷气 |
| 大数字(剩余课时、营收等) | `var(--font-num)` | Georgia 衬线英文数字 |
| 手写 slogan、装饰字 | `var(--font-script)` | 楷体替代 |
| 英文小标签(`TODAY · 3 SESSIONS`) | `var(--font-mono)` | 等宽字体 |
| 正文、按钮、表单 | `var(--font-sans)` | 系统默认 |

### 3.3 字号规范

```css
/* 直接写 px,不用 rpx,避免数字字体变形 */
--t-display: 32px;   /* 大数字 */
--t-h1:      28px;   /* 页面主标题 */
--t-h2:      22px;   /* 区段大标题 */
--t-h3:      17px;   /* 卡片标题 */
--t-h4:      15px;   /* 列表项标题 */
--t-body:    14px;   /* 正文 */
--t-small:   12px;   /* 辅助 */
--t-tiny:    11px;   /* 标签 */
--t-mono:    10px;   /* 等宽英文小字 */
```

---

## 4. 间距(Spacing)

```css
/* 全局间距规则 */
--sp-xs:  4px;
--sp-sm:  8px;
--sp-md:  12px;
--sp-lg:  16px;
--sp-xl:  22px;    /* 页面左右 padding(关键)*/
--sp-xxl: 28px;
```

**页面布局规则**:
- **页面左右 padding**:`22px`(所有页面统一)
- **卡片内 padding**:`14-18px`
- **区段之间 margin-bottom**:`22-28px`
- **列表项之间 gap**:`10-12px`

---

## 5. 圆角与阴影

```css
/* 圆角 */
--r-sm:  4px;     /* 小标签 */
--r-md:  8px;     /* 按钮内的小元素 */
--r-lg:  12px;    /* 内嵌卡片 */
--r-xl:  14px;    /* 主要卡片 */
--r-2xl: 16px;    /* 大卡片、Hero区 */
--r-pill: 100px;  /* 胶囊按钮、Tag */

/* 阴影(冷蓝色调阴影,不用纯黑)*/
--shadow-sm: 0 2px 4px -1px rgba(44, 82, 130, 0.06);
--shadow-md: 0 8px 20px -6px rgba(44, 82, 130, 0.15);
--shadow-fab: 0 12px 24px -8px rgba(44, 82, 130, 0.4);  /* 浮动按钮 */
```

---

## 6. 核心组件规范

### 6.1 Tab Bar(底部导航栏)

**改造 `custom-tab-bar/index.wxml` 和 `.wxss`**:

```css
/* custom-tab-bar/index.wxss */
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 70px;
  background: rgba(244, 247, 250, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--line);
  display: flex;
  padding-bottom: 8px;
  z-index: 999;
}

.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: var(--ink-mute);
  font-size: 10px;
  letter-spacing: 0.5px;
  position: relative;
}

.tab.active {
  color: var(--accent);
}

.tab.active::before {
  content: "";
  position: absolute;
  top: 8px;
  width: 24px;
  height: 3px;
  background: var(--accent);
  border-radius: 0 0 2px 2px;
}

.tab-icon {
  width: 22px;
  height: 22px;
}
```

**注意**:之前用 emoji 作图标,**保留 emoji 即可**,只是颜色和文字改成上面规范。如果以后想换 SVG 图标,V2.0 再做。

### 6.2 按钮(Buttons)

**主按钮(深蓝墨)**:
```css
.btn-primary {
  background: var(--ink);
  color: var(--paper);
  border: none;
  padding: 16px;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 2px;
}
```

**次按钮(白底蓝字)**:
```css
.btn-secondary {
  background: var(--cream);
  color: var(--ink);
  border: 1px solid var(--line);
  padding: 8px 16px;
  border-radius: 100px;
  font-size: 12px;
  font-weight: 500;
}
```

**小按钮(主色)**:
```css
.btn-small {
  background: var(--accent);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 100px;
  font-size: 12px;
  font-weight: 500;
}
```

### 6.3 卡片(Cards)

**标准白卡**:
```css
.card {
  background: var(--cream);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 14px 16px;
}
```

**特性卡(深色)**:
```css
.card-feature {
  background: var(--ink);
  color: var(--paper);
  border-radius: 16px;
  padding: 16px 18px;
}
```

**预警卡(暖橙色)** —— 只用于续费提醒:
```css
.card-alert {
  background: linear-gradient(135deg, #FFF4E6 0%, #FED7AA 100%);
  border: 1px solid #FDBA74;
  border-radius: 16px;
  padding: 16px 18px;
}
```

### 6.4 标签(Tags / Badges)

**主色标签(浅蓝底)**:
```css
.tag {
  background: var(--accent-bg);
  color: var(--accent);
  padding: 1px 7px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
}
```

**警告标签(橙底)**:
```css
.tag-warn {
  background: var(--warn);
  color: white;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 9px;
  letter-spacing: 0.5px;
}
```

### 6.5 表单输入

```css
.form-row {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--line-soft);
  min-height: 56px;
}

.form-label {
  font-size: 13px;
  color: var(--ink-soft);
  width: 80px;
  flex-shrink: 0;
  font-weight: 500;
}

.form-label-required::after {
  content: " *";
  color: var(--accent);
}

.form-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 14px;
  color: var(--ink);
  text-align: right;
  background: transparent;
}
```

### 6.6 头像

```css
.avatar {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: linear-gradient(135deg, #2C5282, #6B91B8);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-serif);
  font-size: 18px;
  font-weight: 600;
}

/* 小头像 */
.avatar-sm {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  font-size: 16px;
}

/* 大头像 */
.avatar-lg {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  font-size: 26px;
  box-shadow: 0 8px 20px -6px rgba(44, 82, 130, 0.4);
}
```

---

## 7. 区段标题(Section Header)

每个页面区段标题的标准样式:

```html
<view class="section-head">
  <view>
    <view class="section-title">今日课表</view>
    <view class="section-title-en">TODAY · 3 SESSIONS</view>
  </view>
  <view class="section-action">查看全部 →</view>
</view>
```

```css
.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 14px;
}

.section-title {
  font-family: var(--font-serif);
  font-size: 17px;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: 0.5px;
  position: relative;
  padding-left: 14px;
}

.section-title::before {
  content: "";
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 14px;
  background: var(--accent);
  border-radius: 2px;
}

.section-title-en {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--ink-mute);
  letter-spacing: 1.5px;
  text-transform: uppercase;
  margin-top: 2px;
  margin-left: 14px;
}

.section-action {
  font-size: 12px;
  color: var(--accent);
  font-weight: 500;
}
```

---

## 8. 顶部品牌 Logo

每个一级页面都有的品牌标志:

```html
<view class="brand-mark">
  <view class="brand-name">
    <view class="brand-name-mark"></view>颂恩艺术
  </view>
</view>
```

```css
.brand-name {
  font-family: var(--font-serif);
  font-size: 16px;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: 2px;
  display: inline-flex;
  align-items: center;
}

.brand-name-mark {
  display: inline-block;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--accent);
  margin-right: 10px;
  position: relative;
}

.brand-name-mark::after {
  content: "颂";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-family: var(--font-serif);
  font-size: 12px;
  font-weight: 700;
}
```

---

## 9. 底部 Slogan(每个一级页面底部)

```html
<view class="footer-quote">
  <view class="footer-quote-text">以声传情 · 以艺会友</view>
  <view class="footer-quote-en">SONG·EN ARTS · est. 2024</view>
</view>
```

```css
.footer-quote {
  margin-top: 32px;
  padding: 0 22px 16px;
  text-align: center;
  opacity: 0.5;
}

.footer-quote-text {
  font-family: var(--font-script);
  font-size: 18px;
  color: var(--accent);
  line-height: 1.5;
}

.footer-quote-en {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--ink-mute);
  letter-spacing: 2px;
  margin-top: 4px;
}
```

---

## 10. 状态处理

### 10.1 加载状态(骨架屏)

**禁用**:`<text>加载中...</text>` 这种简陋写法
**使用**:骨架屏

```html
<view wx:if="{{loading}}" class="skeleton">
  <view class="skeleton-hero"></view>
  <view class="skeleton-card"></view>
  <view class="skeleton-card"></view>
</view>
```

```css
.skeleton {
  padding: 22px;
}

.skeleton-hero {
  height: 120px;
  background: linear-gradient(90deg, #F0F4F8 0%, #E0E8F0 50%, #F0F4F8 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 16px;
  margin-bottom: 16px;
}

.skeleton-card {
  height: 80px;
  background: linear-gradient(90deg, #F0F4F8 0%, #E0E8F0 50%, #F0F4F8 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 12px;
  margin-bottom: 12px;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### 10.2 空状态

```html
<view wx:if="{{!list.length}}" class="empty-state">
  <view class="empty-icon">📝</view>
  <view class="empty-text">还没有学员</view>
  <view class="empty-sub">点击右下角 + 添加第一位学员</view>
</view>
```

```css
.empty-state {
  padding: 80px 22px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  font-family: var(--font-serif);
  font-size: 16px;
  color: var(--ink-soft);
  margin-bottom: 4px;
}

.empty-sub {
  font-size: 12px;
  color: var(--ink-mute);
}
```

### 10.3 错误状态(带重试)

```html
<view wx:if="{{error}}" class="empty-state">
  <view class="empty-icon">😢</view>
  <view class="empty-text">加载失败</view>
  <button class="btn-secondary" bindtap="reload">重试</button>
</view>
```

---

## 11. 改造完成的一致性检查清单

每改完一个页面,Claude Code 自查以下 12 项:

```
□  1. 所有颜色都使用了 var(--xxx),没有硬编码十六进制颜色(除非是设计令牌里没定义的特殊色)
□  2. 所有字号都在 11px-32px 范围内,没有超出
□  3. 标题用了 var(--font-serif),正文用了 var(--font-sans),数字用了 var(--font-num)
□  4. 页面左右 padding 是 22px
□  5. 卡片圆角统一(12px/14px/16px,不是随便的数字)
□  6. 区段之间间距是 22-28px
□  7. Tab bar 仅在一级页面显示
□  8. 一级页面顶部有品牌 logo(brand-name)
□  9. 一级页面底部有 slogan(footer-quote)
□ 10. 加载状态用骨架屏,不是"加载中..."文字
□ 11. 空状态/错误状态都有处理,不是纯白屏
□ 12. 续费提醒类内容用了暖橙色,其他地方都是蓝色
```

---

## 12. 改造禁区(不要碰)

⛔ **不要做的事**:

1. **不要改 JS 逻辑** — 本次只改样式
2. **不要改 wxml 的数据绑定** — 比如 `{{loading}}` 这种逻辑变量不动
3. **不要引入新的依赖** — 不装 vant、tdesign 等组件库,所有样式自己写
4. **不要使用 Google Fonts** — 微信小程序不支持
5. **不要使用 rpx** — 用 px,避免数字字体变形
6. **不要在 wxml 里写内联 style** — 全部放到 wxss
7. **不要因为"觉得好看"加额外的动画** — V1.0 不需要花哨动画

---

## 13. 改造模板(以 teacher/home 为例)

为了让改造高效,我给出 `teacher/home/home.wxss` 的完整改造模板。其他页面参照此模板的结构。

### Before(假设当前样式)

```css
/* 默认样式,什么都没有 */
```

### After(雾霾蓝设计系统)

```css
/* teacher/home/home.wxss */

.page-container {
  min-height: 100vh;
  background: var(--paper);
  padding-bottom: 80px;  /* 留 tab bar 空间 */
}

/* === Hero 区 === */
.hero {
  padding: 12px 22px 20px;
}

.brand-mark {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
}

.greeting-block {
  margin-bottom: 30px;
}

.greeting-date {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-mute);
  letter-spacing: 1.5px;
  text-transform: uppercase;
  margin-bottom: 10px;
}

.greeting-line {
  font-family: var(--font-serif);
  font-size: 28px;
  font-weight: 500;
  color: var(--ink);
  line-height: 1.3;
}

.greeting-line .em {
  color: var(--accent);
  font-style: italic;
  font-weight: 600;
}

.greeting-sub {
  margin-top: 8px;
  font-size: 13px;
  color: var(--ink-soft);
  line-height: 1.5;
}

/* === 数据卡片网格 === */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 28px;
}

.stat-card {
  background: var(--cream);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 16px 16px 14px;
  position: relative;
  overflow: hidden;
}

.stat-card.feature {
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
}

.stat-label {
  font-size: 11px;
  color: var(--ink-mute);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  font-family: var(--font-mono);
  margin-bottom: 6px;
}

.stat-card.feature .stat-label {
  color: rgba(244, 247, 250, 0.5);
}

.stat-num {
  font-family: var(--font-num);
  font-size: 38px;
  font-weight: 400;
  color: var(--ink);
  line-height: 1;
}

.stat-card.feature .stat-num {
  color: var(--paper);
}

.stat-num.accent {
  color: var(--accent);
}

.stat-unit {
  font-size: 13px;
  color: var(--ink-soft);
  margin-left: 4px;
}

.stat-trend {
  margin-top: 8px;
  font-size: 11px;
  color: var(--ink-soft);
}

/* === 今日课表列表 === */
.schedule-list {
  padding: 0 22px;
}

.schedule-item {
  background: var(--cream);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 12px;
}

.schedule-time {
  text-align: center;
  width: 52px;
  flex-shrink: 0;
}

.schedule-time .hr {
  font-family: var(--font-num);
  font-size: 22px;
  color: var(--ink);
  line-height: 1;
}

.schedule-time .min {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--ink-mute);
  margin-top: 3px;
  letter-spacing: 1px;
}

.schedule-divider {
  width: 1px;
  height: 36px;
  background: var(--line);
}

.schedule-info {
  flex: 1;
  min-width: 0;
}

.schedule-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--ink);
  margin-bottom: 3px;
}

.schedule-meta {
  font-size: 11px;
  color: var(--ink-soft);
}

.schedule-action {
  background: var(--ink);
  color: var(--paper);
  border: none;
  padding: 8px 16px;
  border-radius: 100px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

/* === 续费预警(保留橙色)=== */
.alert-card {
  background: linear-gradient(135deg, #FFF4E6 0%, #FED7AA 100%);
  border: 1px solid #FDBA74;
  border-radius: 16px;
  padding: 16px 18px;
}

.alert-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.alert-icon {
  width: 28px;
  height: 28px;
  background: var(--warn);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.alert-title {
  font-family: var(--font-serif);
  font-size: 15px;
  font-weight: 600;
  color: var(--warn-text);
}

.alert-chip {
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid #FDBA74;
  padding: 5px 10px;
  border-radius: 100px;
  font-size: 12px;
  color: var(--warn-text);
}
```

参照此模板,其他 14 个页面的样式按各自页面的内容结构改造,**核心原则不变**:

- 用变量,不写死颜色
- 卡片样式统一
- 字体按规则使用
- 续费/预警相关用暖橙,其他都蓝色

---

## 14. 视觉参考

8 个高保真 HTML 原型可在以下位置查看:

```
/ui/01_teacher_home.html      ← teacher/home 改造目标
/ui/02_student_detail.html    ← teacher/students 详情页 改造目标
/ui/03_parent_home.html       ← parent/home 改造目标
/ui/04_checkin.html           ← teacher/checkin 改造目标
/ui/05_feedback.html          ← teacher/feedback 改造目标
/ui/06_calendar.html          ← teacher/calendar 改造目标
/ui/07_student_list.html      ← teacher/students 列表页 改造目标
/ui/08_payment_form.html      ← teacher/payment 改造目标
```

打开任意 HTML 文件查看视觉效果。**HTML 的 CSS 实现是参考,微信小程序的 wxss 实现需要按本文规范来**(因为字体、CSS 特性有差异)。

未提供 HTML 原型的页面(teacher/profile、parent/records、parent/feedback-detail、parent/payment-list、parent/leave、parent/profile、common/identity、common/bindparent)按本文设计系统**类推改造**,保持风格一致。

---

## 15. 改造完成后的汇报格式

每个页面改完,按以下格式汇报:

```
✅ teacher/home — 已改造
   - 应用了设计令牌:✅
   - 区段标题样式:✅
   - 卡片样式:✅
   - Tab bar:✅
   - 加载状态:✅(骨架屏)
   - 空状态:✅
   - 续费预警橙色保留:✅
   - 自查清单 12 项:全部通过

📸 截图建议:用户在微信开发者工具中预览,确认无误后再改下一个

⚠️ 遇到的问题(如有):
   - ...
```

---

## 16. 全部改造完成后的最后一步

15 个页面全部改完后:

1. 全局做一次**视觉一致性巡查**——把 15 个页面截图排在一起对比,有没有哪个页面跟其他页面"长得不像一家人"
2. 检查 **Tab bar 切换**时的颜色高亮、过渡是否流畅
3. 检查**深色模式**(如果有的话,小程序里可能用户设置了深色模式,wxss 里如果没用 var() 会显示异常)
4. 检查**真机预览**(微信开发者工具 → 预览 → 真机扫码)和模拟器效果是否一致

完成后通知用户验收。
