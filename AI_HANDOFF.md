# AI_HANDOFF.md

## 项目说明

这是一个课程管理微信小程序，面向播音主持培训机构 / 工作室自用。

核心目标：替代老师用 Excel、记事本、微信聊天记录管理学生，把学员、课时、缴费、排课、点名、课后反馈、家长端查看集中到一个小程序里。

技术栈：

- 微信小程序原生：WXML + WXSS + JS
- 微信云开发
- 云数据库
- 云函数
- openid 身份识别
- 小程序订阅消息

完整需求请看：

- PRD_课程管理小程序_V1.1.docx

---

## 模型协作规则

本项目可能会由不同模型接力开发，例如：

- DS / DeepSeek：适合快速写代码、批量改文件、修 bug
- Opus：适合架构设计、复杂逻辑、代码审查、需求拆解

无论当前是哪一个模型，都必须遵守以下规则：

1. 先读 AI_HANDOFF.md
2. 再读 PRD 文档
3. 再读当前相关代码
4. 不要凭记忆乱改
5. 不要一上来重构整个项目
6. 每次改代码前，先说明准备改哪些文件
7. 每次改完后，必须更新本文件的“当前进度”

---

## 当前开发阶段

当前阶段：M1 数据底座准备阶段。

目标是先把项目底层结构搭好，不急着做复杂页面。

---

## V1.0 只做这些核心功能

老师端：

- 学员管理
- 缴费登记
- 课时余额
- 低课时预警
- 排课
- 点名扣课时
- 撤销点名
- 课后反馈
- 首页数据看板

家长端：

- 绑定孩子
- 查看剩余课时
- 查看上课记录
- 查看课后反馈
- 查看缴费记录
- 提交请假

---

## V1.0 暂时不要做

以下功能不要现在开发：

- 多老师账号
- 多权限系统
- 多校区
- 在线支付
- 家长聊天
- 视频课
- 直播课
- 作业批改
- AI 自动生成反馈
- 积分打卡系统
- 复杂财务报表

这些可以先记为 V2，不要影响 V1 开发。

---

## 推荐开发顺序

### M1 数据底座

- 初始化微信云开发
- 创建数据库集合
- 创建基础云函数
- 封装前端 api.js
- 建立项目目录结构

### M2 学员 + 缴费

- 学员列表
- 新增学员
- 学员详情
- 缴费登记
- 课时余额计算

### M3 课表 + 点名

- 周课表
- 新增排课
- 周期排课
- 点名扣课时
- 撤销点名

### M4 反馈系统

- 评分维度
- 快捷模板
- 保存反馈
- 家长端查看反馈

### M5 家长端

- 家长绑定
- 家长首页
- 上课记录
- 缴费记录
- 请假

### M6 数据看板 + 消息

- 今日待上
- 本月课消
- 本月收入
- 低课时预警
- 上课前提醒

### M7 测试上线

- 真机测试
- 修 bug
- 小程序提审

---

## 数据库集合

需要创建以下集合：

- teachers
- students
- course_packages
- orders
- course_balance
- schedules
- attendance
- feedbacks
- leaves

注意：PRD 里有一处写“共 7 个集合”，但实际业务列出了 9 个集合。开发时以这里的 9 个为准。

---

## 核心业务规则

### 缴费

登记缴费时：

1. 新增 orders 记录
2. 更新 course_balance
3. remaining 增加课时数

### 点名

点名时：

1. 写入 attendance
2. 到课学生扣课时
3. 更新 course_balance
4. 更新 students.total_attended
5. 更新 schedules.status = done

点名逻辑必须放在云函数里，不要在前端直接改多个表。

### 撤销点名

撤销时：

1. 回滚 attendance
2. 回滚 course_balance
3. 回滚 students.total_attended
4. schedules.status 改回 pending
5. 如已有 feedback，需要提示是否删除

### 家长绑定

家长首次进入小程序，用：

- 孩子姓名
- 家长手机号

匹配 students 表。匹配成功后绑定 parent_openid。

---

## 当前进度

已完成：

- PRD 已整理
- 产品方向已明确
- V1.0 功能范围已明确
- 数据模型已明确
- 开发里程碑已明确
- 微信云开发环境 ID 已确认: cloud1-d4gerzfz6069ec252（CLI 实际可访问环境，2026-06-14 已部署）
- 数据库 9 个集合已创建
- 云函数 20 个已部署 + 安全校验
- 2026-06-14 09:18 CST：已通过微信开发者工具 CLI 部署 27 个业务云函数到 `cloud1-d4gerzfz6069ec252`，全部 success；未部署 `cm_clearData`、`cm_courseReminder`、`cm_batchBalance`（本轮未改动/避免误触）。
- 2026-06-14：接入 `miniprogram-automator` 做真实点击测试。已覆盖身份页、家长绑定、老师 tab、学员新增入口、课表弹窗、点名空提交、反馈缺课程入口、缴费空提交、老师资料空提交、家长记录筛选/详情跳转、家长请假空提交、家长个人中心测试态。修复录音组件卸载时报 `offStart is not a function`、反馈页缺 `scheduleId` 时露出假编辑表单、学员新增按钮不够明确、学员卡手机号/日期横排拥挤等问题。当前账号不是管理员/绑定家长，家长端真实数据权限受限，父端部分 UI 使用自动化注入数据验证点击和布局。
- 2026-06-14：核实并修复新增安全/逻辑问题：`cm_bindParent` 改为事务内查询+占用检查+绑定，降低并发覆盖风险；`cm_initDB` 增加管理员或 `INIT_SECRET` 鉴权并保留默认课程包空表才插入；`cm_saveFeedback` 前后端均拒绝全 0/无评分反馈，只提交 1-5 有效评分；`cm_createOrder` 事务内读学生/课程包改为串行 await；`cm_verifyInviteCode` 增加 24 小时前 `invite_attempts` 清理。验证：全量 `node --check`、`git diff --check`、WXML 事件绑定扫描、微信 DevTools `preview` 通过；后端 mock 测试确认 0 分/无评分拒绝、1 分通过；前端 automator 测试确认全 0 评分保存被拦截。
- 前端 15 个页面 + 4 个组件 + tab-bar 已实现
- api.js 已封装
- **P0 安全修复完成**(邀请码 + 云函数鉴权 + 客户端写入下沉)
- **UI 改造完成**: 雾霾蓝设计系统 V1.0 全量落地
- **弥散风 UI 打磨进行中**:
  - 父端首页已去掉突兀返回圆点和旧大脸贴片感
  - 新增父端首页抽象主视觉 `miniprogram/images/parent-voice-mist.png`
  - 父端首页改为“声音轨迹 / 成长回声”弥散艺术首屏
  - 父端数据卡、声音轨迹面板、记录页时间线、个人中心测试横幅、请假表单已统一成轻雾玻璃风格
  - 全局 feature 数据卡文字、弹窗遮罩、按钮残留深色已继续减重

未完成：

- cm_courseReminder 的订阅消息模板 ID 未填(待去微信公众平台申请)
- M7 真机测试 + 小程序提审
- 弥散风 UI 还需要真机逐屏视觉复核；当前已完成静态绑定/路由检查和微信开发者工具预览编译

---

## 当前问题

1. 需要确认云开发环境 ID
2. 需要确认 project.config.json 里的 cloudfunctionRoot 是否正确
3. 需要确认 cloudfunctions 目录是否存在
4. 需要确认微信开发者工具服务端口是否已打开
5. 需要避免不同模型重复重构
6. 小程序真实自动点击工具尚未接入；当前避免触发请假、点名、缴费、保存反馈等写数据动作

---

## 最近一次 UI 验证记录

时间：2026-06-13

已验证：

- `git diff --check` 通过
- 父端静态扫描通过：
  - 无 `parent-back`
  - 无 `parent-face` / `hero-face-mist` 旧首页引用
  - 无负 `letter-spacing`
  - 无危险 WXSS 子选择器 `> *`、`+ *`、`~ *`
  - 无父端旧深色黑块命中
- WXML 绑定方法和可解析跳转路由检查通过：17 个页面
- 微信开发者工具 CLI `preview` 通过
  - 包体：604.4 KB

注意：

- 真实自动点击未完成，因为本机没有稳定接入 `miniprogram-automator`，DevTools CLI 只有预览/自动化启用入口，没有直接脚本点击接口。
- 测试时不要触发会写入云端数据的按钮：提交请假、确认点名、保存缴费、保存反馈、保存学员、删除学员、保存课程包等。

## 下一步任务

请当前模型先做 M1：

1. 检查项目目录结构
2. 检查 project.config.json
3. 创建 cloudfunctions 目录
4. 创建 miniprogram/pages 基础目录
5. 创建数据库集合初始化云函数
6. 写 README.md 简要说明
7. 更新本 AI_HANDOFF.md

---

## 交接要求

每次模型完成任务后，在这里补充：

### 本次修改

- 修改了哪些文件
- 新增了哪些文件
- 删除了哪些文件

### 当前状态

- 哪些功能已完成
- 哪些功能还没做
- 哪些地方有 bug

### 下一步建议

- 下一个模型应该先看哪些文件
- 下一个模型应该继续做什么
- 哪些地方不要动

---

## 交接记录 · 2026-05-11 · UI 全量改造

### 本次修改
- **新增**: `/ui/` 目录(设计文档 + 9 个 HTML 原型)
- **重写**: `app.wxss`(全局设计令牌)
- **重写**: `custom-tab-bar/index.wxss`(毛玻璃 + 蓝色指示条)
- **重写**: 4 个组件 wxss(student-card / audio-recorder / rating-stars / empty-state)
- **重写**: 15 个页面 wxss(老师端 8 + 家长端 6 + common 2)
- **备份**: `*.wxss.bak` 保留原版

### 改造原则(严格遵守)
- ✅ 不改 wxml 结构,只改 wxss 样式
- ✅ 不改 JS 逻辑
- ✅ 全部用 px(不用 rpx)
- ✅ 全部用 var(--xxx),零硬编码色(除令牌定义自身和特殊渐变)
- ✅ 不引入新依赖
- ✅ 不用 Google Fonts(系统宋/楷/Georgia/SF Mono 回退)

### 设计系统要点(参考 /ui/UI_设计系统_V1.0.md)
- **色板**: 雾霾蓝(--paper / --ink / --accent) + 暖橙警告(--warn)
- **字体**: 标题宋体 / 数字 Georgia / 标签 SF Mono / 正文系统字
- **字号**: 10-32px 区间
- **圆角**: 4/8/12/14/16/100 六档
- **核心组件**: brand-mark / section-title / card / btn-primary / tag / avatar

### 当前可能的 UI 隐患
1. **一级页面未加 brand-mark 和 footer-quote**(文档第 8/9 节要求,但要改 wxml,未做)
2. **parent/home loading 仍是"加载中..."文字**(文档要求骨架屏,要改 wxml,未做)
3. **真机字体回退效果未验证**(微信小程序 Android 端可能不支持 STSong/STKaiti)

### 下一步建议
1. 真机预览所有 15 个页面,有问题统一汇总修复
2. 如需加 brand-mark / footer-quote / 骨架屏,需小幅改动相关 wxml
3. 申请订阅消息模板 → 填 cm_courseReminder 的 TEMPLATE_ID
4. M7 真机测试 + 小程序提审

### 禁止
- 不要回滚 app.wxss 的设计令牌
- 不要把 px 改回 rpx
- 不要在 wxml 写内联 style
- 不要因"觉得好看"加额外动画

---

## 交接记录 · 2026-06-12 · UI V2 粉黑线描风改造

### 本次修改
- **新增**: `ui/09_pink_black_style_demo.html` 风格演示页
- **新增**: `ui/09_pink_black_style_demo_preview.png` 演示预览图
- **改造**: `miniprogram/app.wxss` 增加 V2 粉黑线描覆盖层和全局令牌
- **改造**: `custom-tab-bar/index.wxss` 改为白底黑色图标栏 + 选中小圆点
- **重点改造**: 老师首页、家长首页、课表、点名、身份选择、学员详情、家长个人中心、缴费记录
- **同步改造**: 学员卡、录音组件、反馈页、上课记录、新增学员、缴费登记等样式细节

### 设计方向
- 参考用户给的粉黑 App 截图,风格关键词: **奶油白 / 深葡萄黑 / 浅粉强调 / 大圆角 / 线描感 / 情绪疗愈感**
- 主色从雾霾蓝切换为粉黑体系:
  - `--paper: #FBF8F7`
  - `--ink: #220016`
  - `--accent: #EDA7DB`
  - `--accent-bg: #FFF0FA`
- 主按钮、关键操作、深色信息面板统一使用 `--ink`
- 粉色主要用于辅助底色、头像、标签、状态点缀,避免整页过甜

### 当前状态
- 已完成第一轮全局换肤和核心页面定调
- 未改业务 JS,未改数据库字段,未改云函数逻辑
- 保留 rpx 小程序适配方案
- 已执行 `git diff --check` 检查,未发现空白/补丁格式问题

### 下一步建议
1. 用微信开发者工具预览老师端首页、课表、点名、学员详情、家长首页,先看第一眼方向和操作可读性
2. 根据真机效果微调字号、卡片高度、底部 tab 安全区
3. 第二轮再精修: 老师 profile 课程包管理、家长 records 时间线、feedback 录音/评分细节
4. 如需更像参考图,可小幅改 WXML 增加线描插画块 / 黑色底部 sheet 式模块

### 追加记录 · 2026-06-13 · 原创线描主视觉
- 用户反馈:前一版只换肤,和演示图差距大;可以加入图片,且主图不必照搬参考图,可以原创设计
- **新增/重做本地 SVG 资产**:
  - `miniprogram/images/hero-teacher.svg`: 老师首页原创线描主视觉,白底圆角 + 粉色长椅 + 一笔线人物 + voice 气泡
  - `miniprogram/images/hero-start.svg`: 身份页同风格启动插画
  - `miniprogram/images/hero-face.svg`: 家长首页粉色圆脸插画
  - `miniprogram/images/hero-checkin.svg`: 点名页粉色圆脸 + 到课/请假/缺勤状态视觉
- **结构改造**:
  - `teacher/home.wxml`: 改为大标题 + 搜索条 + 插画 + 功能卡 + 黑色 Practices 面板
  - `parent/home.wxml`: 加入粉色圆脸主视觉和黑色状态面板
  - `common/identity.wxml`: 加入启动插画
  - `teacher/checkin.wxml`: 加入点名主视觉和黑色课程信息叠层
- 注意:不要再只靠 WXSS 换色;这个风格的关键是图片/插画参与首屏构图

### 追加记录 · 2026-06-13 · 迷散艺术感增强
- 用户要求:要有艺术气息,不是普通原始小程序;参考"迷散风格设计"
- 设计理解:像艺术工作室的小型数字画册,强调朦胧、散点、留白、错位、展签文字,而不是管理后台式卡片堆叠
- **全局增强**:
  - `app.wxss` 增加纸感散点背景、白色圆形轨迹、`art-kicker` / `art-note` / `art-chip` 艺术展签样式
- **四个核心界面增强**:
  - 身份页:改成工作室画册封面感,角色卡加入编号和艺术符号
  - 老师首页:加入 `SONGEN ATELIER · DAILY SCORE` 展签、艺术说明文案、错位圆形装饰
  - 家长首页:加入 `FAMILY ALBUM` / `TODAY'S VOICE` 画报说明和黑色状态面板标题
  - 点名页:加入 `ATTENDANCE AS SCORE` 艺术说明和迷散圆形装饰
- 继续原则:功能信息必须清晰,但首屏气质要先传达"颂恩艺术"而不是"管理系统"

### 追加记录 · 2026-06-13 · 艺术化收口
- 用户授权:继续自行判断,做到满意后再汇报
- 本轮目标:去掉普通小程序/管理后台气息,让 4 个核心界面更像艺术工作室画册
- **文案收口**:
  - 老师首页去掉随手 emoji,改为 `今日声场`、`Low Balance`、`今日留白,适合整理声音`
  - 家长首页去掉 `📊/📅/📝/📋/📖` 等普通图标,改为 `Balance Archive`、`Next Session`、`Latest Note`、`Studio Actions`
  - 身份页 `我是老师/我是家长` 改为 `老师入口/家长入口`
  - 点名页低课时提示改为 `LOW · n节`
- **符号系统**:
  - `custom-tab-bar/index.js` 从 emoji 图标改为 `⌂ / ◷ / ◎ / ◌ / ◇` 等艺术符号
  - tabBar 增加毛玻璃和更克制的画廊式符号状态
- **构图收口**:
  - 老师首页功能卡加入轻微错位,减少后台网格感
  - 家长首页操作卡加入轻微错位,增强迷散画册感
- 下一轮如果继续:优先做真机预览后的间距、字号、首屏高度微调

### 禁止
- 不要再回到蓝色设计系统
- 不要把 `app.wxss` 末尾的 V2 覆盖层删除
- 不要为了视觉效果改动点名/缴费/扣课时业务逻辑

### 追加记录 · 2026-06-13 · 空白页修复与预览通过
- 用户反馈:开发者工具/预览里只显示蓝色标题栏“课程管理”,主体空白
- **根因**:微信开发者工具 CLI 报 `app.wxss` 编译错误:
  - `./app.wxss(1056:14): error at token '*'`
  - 对应选择器为 `.container > *`,小程序 WXSS 编译器不支持这个通配子选择器
- **修复**:
  - 将 `.container > *` 替换为 `.container > view/text/image/button/input/scroll-view/swiper` 等显式选择器
  - 四个主视觉从 SVG 引用切换为 PNG 引用,降低小程序 `<image>` 兼容风险:
    - `hero-start.png`
    - `hero-teacher.png`
    - `hero-face.png`
    - `hero-checkin.png`
  - 全局和四个核心页面导航栏从蓝色改为纸白粉黑系统,标题统一为“颂恩艺术”(点名页保留“点名”)
- **验证**:
  - 已运行微信开发者工具 CLI:
    - `/Applications/wechatwebdevtools.app/Contents/MacOS/cli preview --project /Users/yinlei/Desktop/YINLEI/CLass-project --compile-condition '{}'`
  - 结果: `✔ preview`,包体 `434.7 KB`
- 注意:后续不要使用 `> *`、`+ *`、`~ *` 这类通配组合选择器写 WXSS;小程序编译器可能直接失败导致整页空白

### 追加记录 · 2026-06-13 · 迷散风格细节优化
- 用户反馈:已经“有感觉”,继续点击小程序并细化风格文字
- **观察**:老师首页首屏已经有画册感,但英文展签、播放按钮、指标卡文案仍有轻微模板感
- **本轮优化**:
  - 老师首页:
    - 展签改为 `声场手账 · DAILY SCORE`
    - 搜索改为 `查找学员 / 课次 / 回声`
    - `今日待上` 改为 `今日练习`, `课时预警` 改为 `余课提醒`
    - `Practices / See All` 改为 `今日排练 / 全览`
    - 功能卡加入细线、轻微旋转和更克制的箭头符号
  - 身份页:
    - 标题从英文营销口号改为 `进入一间 / 声音工作室`
    - 副标题改为 `选一个入口,继续今天的声场手账`
  - 家长首页:
    - 英文模板标题改为 `成长回声 / 今日回声 / 声音轨迹 / 课时档案 / 下次相见 / 课后回声 / 工作室动作`
    - 移除位置 emoji,改为 `教室 · ...`
  - 点名页:
    - `ATTENDANCE AS SCORE` 改为 `点名谱记 · ATTENDANCE`
    - 扣减文案改为 `本次将写入 n 次到课`
  - 加载态:
    - `LOADING...` 改为 `正在翻开回声...` / `正在校准声场...` / `整理中`
- **验证**:
  - 微信开发者工具 CLI `preview` 已通过,包体约 `435.7 KB`
- 后续如继续优化:优先观察家长首页和点名页真机首屏,再微调面板高度和按钮密度

### 追加记录 · 2026-06-13 · 按钮/保存/排版细节巡检
- 用户反馈:课表周切换里 `今天` 被挤到下一行,要求逐个按钮点开看格式、字体、能不能点、能不能保存
- **确定修复**:
  - `teacher/calendar` 周切换结构改为 `week-date + today-btn` 横向 flex:
    - 日期区间可省略
    - `今天` 固定不换行
  - 日历页排课弹窗、空态、课程卡片改为同一套粉黑手账风格
- **交互/保存检查**:
  - 用脚本扫描页面 WXML 的 `bindtap/catchtap/bindlongpress` 对应 JS 方法,结果全部存在
  - 对照 `app.json` 检查老师首页、课表、学员、点名、反馈、家长记录等核心跳转路径,未发现指向不存在页面
  - 反馈页修复隐藏体验风险:切换学员时若当前评分/评语/录音未保存,先弹窗提示保存,避免误点丢内容
- **风格断层修补**:
  - 学员册、学员卡、课后反馈、录音组件、老师我的、缴费登记、家长记录/反馈详情/请假/我的等页面去除 emoji 和 `加载中...` 模板文案
  - 统一为 `学员册 · STUDIO ROSTER`、`课后回声 · VOICE NOTE`、`工作室设置 · STUDIO DESK`、`课费手账 · PAYMENT NOTE` 等艺术展签语言
  - 空状态组件默认图标从 emoji 改为 `◇`
- **验证**:
  - `git diff --check` 通过

### 追加记录 · 2026-06-13 · 功能按钮巡检与可点性修复
- 用户要求:UI 基本满意,重点测试所有可点击按钮,修复不能点击/跳转失败/保存状态不稳的问题,顺手修格式和样式细节
- **核心功能修复**:
  - 新增老师端非 tab 页面 `pages/teacher/students/feedbacks`,用于学员详情里的“最近上课 → 全部”
  - 修复 `teacher/students/detail` 使用 `navigateTo` 打开家长 tab 页导致失败的问题
  - 学员详情的最近反馈卡片现在可点击进入老师反馈页继续查看/补写
  - `parent/home` 声音轨迹面板里的“全部 / 请假 / 到课 / 反馈”从视觉入口改成真实可点入口
- **权限与数据稳定性**:
  - `cm_getStudentDetail` 支持 `feedbackLimit`,用于完整反馈历史读取
  - `api.getOrders` / `api.getStudentFeedbacks` 改走 `cm_getStudentDetail`,减少真机数据库直读权限差异
  - 老师查看学员缴费/反馈历史统一走老师云函数权限链路
- **保存/提交防护**:
  - 身份页验证/初始化/返回按钮增加重复点击拦截和 disabled 状态
  - 排课弹窗补充空学员/空课程包状态,保存按钮在基础数据缺失时禁用
  - 排课保存增加开始时间、周期截止日期、截止日期不能早于开始日期校验
  - 缴费保存增加管理员校验、防重复提交、非法支付方式/课时数/金额/课程包数据校验
  - 请假保存增加学员信息、课程信息、原因索引校验和防重复提交
  - 新增/编辑学员增加重复保存拦截、重复标签提示、编辑态缺少 studentId 校验
  - 点名状态切换、确认提交、撤销点名增加提交中拦截
  - 反馈页重新录音/取消替换在上传或保存中禁止切换
- **样式细节**:
  - 新增老师端反馈全集页面使用弥散浅粉玻璃时间线风格
  - 学员详情反馈卡片增加点击反馈,避免看起来只是静态文字
  - 排课/缴费/请假的空状态文案更明确,减少“按钮能点但无数据”的误解
- **验证**:
  - `node --check` 扫描 `miniprogram` 与 `cloudfunctions` 下 JS 通过
  - `git diff --check` 通过
  - WXML 绑定函数扫描通过:18 个页面
  - 路由存在性与 `navigateTo/switchTab` 页面类型扫描通过
  - 微信开发者工具 CLI `preview` 通过,包体约 `621.0 KB`
- **注意**:
  - 本轮没有真实点击会写云端数据的按钮,避免误提交请假、点名、缴费、反馈、学员/课程包修改
  - 若后续接入 `miniprogram-automator` 或真机测试,建议优先覆盖:
    1. 老师首页 → 学员册 → 学员详情 → 最近上课全部 → 反馈页
    2. 老师首页 → 课表 → 新增排课弹窗各字段
    3. 老师首页 → 今日排练 → 点名 → 确认 sheet
    4. 老师我的 → 切换家长视角 → 家长首页 → 声音轨迹 / 请假 / 反馈集
  - 静态扫描:未再发现旧 emoji、`LOADING`、`加载中...`、`课程管理` 等模板残留
  - WXSS 扫描:未发现 `> *`、`+ *`、`~ *` 通配组合选择器
  - 微信开发者工具 CLI `preview` 通过,包体约 `444.3 KB`
- 后续如继续:建议打开开发者工具逐页肉眼看 `课表 -> 新增排课 -> 保存排课`、`今日排练 -> 点名 -> 提交确认`、`反馈 -> 保存回声并继续` 的真机交互节奏和首屏高度

### 追加记录 · 2026-06-13 · 弥散风降黑与首页插画融合
- 用户反馈:当前 UI 黑色太突兀,首页中间插画不协调;提供小红书"弥散风 UI"参考
- **设计调整方向**:
  - 从"粉黑线描"收敛为"弥散风 / 雾面渐变 / 低对比 / 玻璃感"
  - 黑色不再作为大面积按钮块,改成柔和梅子色 `--plum / --plum-soft / --plum-deep`
  - 保留深色只做文字层级和少量功能重点
- **关键修改**:
  - `app.wxss`:新增梅子色变量,降低 `--ink` 黑度,重写按钮/浮动按钮/阴影为梅子渐变
  - `teacher/home`:首屏从"插画放在白卡里"改为"文字 + 透明插画 + 搜索"融合在粉雾 hero 中
  - 新增 `miniprogram/images/hero-teacher-mist.png`:从原 800x800 插画裁出横向主体,并把近白背景转透明
  - `teacher/calendar`:周切换箭头、选中日期、空态卡改成玻璃感/梅子渐变,减少黑圆突兀
  - `teacher/students` + `student-card`:学员管理顶部大黑块改为弥散浅色 hero,列表卡改为半透明雾面卡
  - `custom-tab-bar`:选中态从黑圆改为梅子渐变
  - `teacher/checkin/feedback/students-detail`:大面积深底改为梅子雾面渐变
- **验证**:
  - `git diff --check` 通过
  - 微信开发者工具 CLI `preview` 通过,包体约 `481.1 KB`
- 后续:建议用户重新截图老师首页、课表、学员管理三页,重点看黑色是否已降下来、首页插画是否融入背景

### 追加记录 · 2026-06-13 · 家长端弥散风同步与点击检查
- 用户反馈:家长端似乎没有同步修改,并要求仔细点一点看是否报错
- **家长端视觉同步**:
  - `parent/home`:家长首页 hero、学员概览、声音轨迹、课时档案、快捷动作统一改为弥散浅色/梅子雾面/半透明卡片,去掉硬黑块突兀感
  - `parent/records`:反馈集 hero、筛选 active、记录卡统一玻璃感,active 从黑底改为梅子渐变
  - `parent/feedback-detail`:详情 hero 和内容卡统一梅子雾面 + 半透明卡片
  - `parent/leave`:请假页 hero、表单、原因选项统一弥散风
  - `parent/profile`:家长我的信息卡、设置列表改为梅子雾面和半透明卡
  - `parent/payment-list`:即使当前家长端不展示缴费列表,预留样式也从黑底改为梅子雾面
- **点击/报错检查**:
  - 扫描 parent 页面和 custom tab 的 `bindtap/catchtap/bindlongpress`,对应 JS handler 全部存在
  - 扫描 parent 端静态 `navigateTo/switchTab/reLaunch` 路径,均存在于 `app.json`
  - 修复/增强:
    - 家长首页 `goFeedbackDetail`:无反馈或缺少 `schedule_id` 时给 toast,避免点击没反应
    - 家长记录 `goFeedbackDetail`:缺少 `schedule_id` 时给 toast,避免点击没反应
- **验证**:
  - `git diff --check` 通过
  - parent 端旧黑底/emoji/`加载中...` 扫描干净
  - 微信开发者工具 CLI `preview` 通过,包体约 `483.6 KB`
- 说明:未实际点击 `提交请假` 写入云数据,避免污染真实业务数据;提交流程做了代码路径和编译验证

### 追加记录 · 2026-06-13 · 家长首页插画去方块与弥散细节收口
- 用户反馈:家长首页中间人物图像有明显方形底,整体仍显突兀
- **修复重点**:
  - `parent/home`:首页人物图从 `/images/hero-face.png` 切换为透明裁切版 `/images/hero-face-mist.png`
  - 调整人物位置、尺寸、透明度和背后软光,让插画融入弥散 hero,不再像贴在卡片上的方块
  - `parent/home`:学员概览和声音轨迹从深梅色大块改为浅梅子玻璃感,降低压迫感
  - `parent/records`:筛选 active 从深色渐变改为粉雾高亮
  - `parent/feedback-detail`、`parent/profile`、`parent/payment-list`:清理残留深色大块,统一为浅梅子雾面卡
- **验证**:
  - `git diff --check` 通过
  - WXSS 扫描:未发现 `> *`、`+ *`、`~ *` 通配组合选择器
  - parent 端静态点击/路由检查通过
  - parent 端未再扫描到 `hero-face.png`、`#5E274D`、`#7A4268`、纯黑/近黑背景残留
  - 微信开发者工具 CLI `preview` 通过,包体约 `513.0 KB`
- 说明:本轮未实际提交请假等写数据动作,避免污染真实云数据

### 追加记录 · 2026-06-13 · 截图问题复盘与全端弥散细节打磨
- 用户反馈:不应由用户发现反馈详情遮挡、学员页新增按钮遮挡列表、老师后台深色块不统一;当前弥散感仍有差距
- **本轮修复**:
  - `parent/feedback-detail`:取消 hero 与课程信息卡的负间距叠压,日期/课程名独立成雾面卡,避免文字撞在一起
  - `teacher/students`:移除列表页固定悬浮 `+` 按钮,改为 hero 右侧雾面圆形新增按钮,不再遮挡学员卡
  - `teacher/profile`:后台手账 hero 从深色块改为浅梅子弥散 hero,测试工具/引导按钮同步降重
  - `teacher/payment`、`teacher/feedback`、`parent/leave`:去掉 hero 负间距,避免卡片压字;预览/课程信息卡改为浅雾面
  - `teacher/checkin`、`teacher/students/detail`、`teacher/home`:深色课程卡/学员主卡/练习面板统一降为浅梅子玻璃感
  - `teacher/calendar`、`audio-recorder`、`common/identity`:选中态、播放按钮和入口图标从深色改为粉雾高亮
- **主动检查**:
  - 扫描 `#5E274D`、`#7A4268`、`background: var(--ink)`、近黑梅色大块、负 `margin-bottom`:业务页面未再命中
  - 扫描 `.fab`:当前仅课表页保留固定新增按钮;学员列表不再使用悬浮按钮
  - 全页面 `bindtap/catchtap/bindlongpress` 对应 JS handler 检查通过
  - 全页面静态 `navigateTo/switchTab/reLaunch` 路由检查通过
- **验证**:
  - `git diff --check` 通过
  - WXSS 扫描:未发现 `> *`、`+ *`、`~ *` 通配组合选择器
  - 微信开发者工具 CLI `preview` 通过,包体约 `516.7 KB`
- 说明:本轮仍未实际提交点名/请假/缴费等写数据动作,避免污染真实云数据

### 追加记录 · 2026-06-13 · 弥散风系统级抛光
- 用户反馈:已有进步,询问是否还能继续优化
- **本轮方向**:
  - 从"修突兀点"推进到"统一设计系统":按钮、选中态、字距、特性卡默认样式
  - 让深梅色退到文字/少量点缀,大面积交互面改为粉雾高亮
- **关键修改**:
  - 全量清理 WXSS 负字距,中文/数字混排不再被压紧
  - `app.wxss`:全局主按钮、小按钮、FAB、品牌圆标统一为粉雾渐变 + 深梅文字
  - `custom-tab-bar`:选中图标从深梅底白字改为粉雾高亮
  - `teacher/home`、`teacher/calendar`、`teacher/feedback`:局部 CTA / active / pressed 态同步改成粉雾层
  - `app.wxss`:全局 `stat-card.feature` / `card-feature` 从深梅卡改成浅雾面,避免未来新增页面复发深色块
- **验证**:
  - 扫描负字距、`#5E274D`、`#7A4268`、近黑梅色大块、`background: var(--ink)`:未命中
  - `git diff --check` 通过
  - WXSS 扫描:未发现 `> *`、`+ *`、`~ *` 通配组合选择器
  - 全页面点击 handler 和静态跳转路由检查通过
  - 微信开发者工具 CLI `preview` 通过,包体约 `517.4 KB`

### 追加记录 · 2026-06-14 · 安全审查修复
- 用户提供《完整安全 + 逻辑审查报告（已核实版）》并要求开始修复
- **安全修复**:
  - `cm_bootstrapAdmin`:必须配置云函数环境变量 `INIT_SECRET` 且调用传入匹配 `event.secret` 才允许初始化;并改为事务 check-then-add
  - `cm_initDB`:不再默认创建首位管理员;仅在 `INIT_SECRET` 匹配时才 bootstrap
  - `cm_sendNotice`:移除客户端传 `templateId/page` 的能力,改为服务端白名单 `type=courseReminder`;模板 ID 从环境变量 `COURSE_REMINDER_TEMPLATE_ID` 读取;接收人必须是已绑定家长 openid
  - `cm_generateInviteCode`:邀请码从 6 位数字改为 8 位 hex 随机码,新增 `attempt_count/locked`
  - `cm_verifyInviteCode`:校验 8 位邀请码;单码 5 次失败锁定;新增 `invite_attempts` 按 openid 统计 1 小时内最多 10 次失败
  - `cm_getParentData`:老师测试视角 bypass 收紧为仅 `is_admin === true` 的管理员可指定 `studentId`
  - `api.js`:残留的 `getStudent/getBalance/getTeacher` 前端直读数据库改为走云函数/全局身份缓存
- **逻辑修复**:
  - `cm_deleteStudent`:删除相关数据改为循环批量删除,不再受默认 20 条限制;同时从 `schedules.student_ids` 移除该学员,移除后为空的待上课程改为 `cancelled`
  - `cm_stats`:收入、预警、今日课表改为分页拉取,避免默认 20 条截断;预警学员、课程包、请假数据改为分批查询
  - `cm_undoCheckin`:撤销点名不再删除反馈;前端撤销文案改为“已写的课后反馈会保留”
  - `cm_createOrder`:写订单前校验学员存在且未结业、课程包存在且启用
  - `cm_createSchedule`:周期排课超过 52 节时返回 `truncated: true` 和提示;前端显示后端 message
  - `payment.js`:自动计算金额改为 `toFixed(2)` 后再写入,避免浮点小数尾巴
  - `cm_submitLeave`:先 `requireAnyUser()` 验登录,再读学生数据
- **新增集合**:
  - `invite_attempts`:邀请码失败尝试记录;`cm_initDB` 已加入集合创建列表
- **部署注意**:
  - 需要重新上传/部署这些云函数:
    - `cm_bootstrapAdmin`
    - `cm_initDB`
    - `cm_sendNotice`
    - `cm_generateInviteCode`
    - `cm_verifyInviteCode`
    - `cm_getParentData`
    - `cm_deleteStudent`
    - `cm_stats`
    - `cm_undoCheckin`
    - `cm_createOrder`
    - `cm_createSchedule`
    - `cm_submitLeave`
  - 云函数环境变量:
    - `INIT_SECRET`:仅初始化管理员时临时配置,生产期建议不配置或配置后不暴露给前端
    - `COURSE_REMINDER_TEMPLATE_ID`:订阅消息模板 ID,未申请前 `cm_sendNotice` 会返回“模板未配置”
  - 老的邀请码从本次起改为 8 位;旧 6 位邀请码不可再用于注册
- **验证**:
  - `node --check` 扫描 `miniprogram` 与 `cloudfunctions` 下 JS 通过
  - `git diff --check` 通过
  - WXML handler / 路由扫描通过:18 个页面
  - 微信开发者工具 CLI `preview` 通过,包体约 `620.1 KB`

### 追加记录 · 2026-06-14 · 已核实新问题补修
- 用户追加“已核实新问题”并要求有问题直接修、修后自测
- **前端体验修复**:
  - `teacher/feedback`:反馈页数据加载失败时补充 toast,不再只停留空白 loading
  - `teacher/students/detail`:学员详情加载失败时补充 toast
  - `teacher/calendar`:周课表加载失败时补充 toast
  - `teacher/checkin`:撤销点名失败时补充 toast
- **云函数修复**:
  - `cm_getSchedules`:把 `students`、`course_packages`、`leaves` 的 `_.in()` 查询改为每批最多 100 个 ID
  - `cm_getSchedules`:每批查询再做分页读取,避免 100 个排课 ID 下超过 100 条请假记录时被云数据库默认截断
- **再次确认**:
  - `cm_initDB` 已有管理员 / `INIT_SECRET` 权限保护
  - `cm_initDB` 默认课程包仅在 `course_packages` 为空时插入,重复调用不会再追加重复默认包
- **验证**:
  - `node --check` 扫描 `miniprogram` 与 `cloudfunctions` 下 JS 通过
  - `git diff --check` 通过
  - 本地 mock 验证 205 个 ID 会分为 `100/100/5`;150 条请假记录可分页取全;无任何一次 `_.in()` 超过 100

### 追加记录 · 2026-06-14 · 排课/点名真实点击问题修复
- 用户指出:不应只编译预览,需要真实点击;“全览”要能点;提交点名确认扣减时报“未找到学员”;没有缴费的课程包不应在加课时可选
- **逻辑修复**:
  - `calendar`:排课弹窗改为先选学员,再按所选学员的课时余额过滤课程包;没有余课/未缴费课程包不再显示
  - `calendar`:仅剩一个可用课程包时自动选中,减少误操作
  - `cm_createSchedule`:后端新增课程包余额校验,绕过前端也不能给未缴费/无余课学员排该课程包
  - `cm_batchBalance`:支持返回每个学员按课程包拆分的余额;同时补充分批与分页,避免默认 100 条截断
  - `checkin`:点名页显示“当前课程包余课”,不再用总余课误导;当前课程包无余课时不能切到“到课”
  - `cm_checkin`:余额缺失/不足时返回具体学员姓名和“该课程包余课”原因,不再显示生硬的“未找到学员课时余额”
  - `home`:“全览”点击区域扩大到今日排练标题区,并强化按钮样式
  - `format`:修复 `YYYY-MM-DD HH:mm` / `YYYY-MM-DD` 在 iOS 下 `new Date()` 解析兼容警告
- **样式细节**:
  - `calendar`:取消状态样式同时兼容 `cancelled/canceled`
  - `calendar`:排课学员列表显示总余课,课程包 picker 显示“余课 N 节/共同余课 N 节”
- **验证**:
  - 微信开发者工具自动化真实点击:首页“全览” → 成功进入 `pages/teacher/calendar/calendar`
  - 微信开发者工具自动化真实点击:课表 “+” → 排课弹窗成功打开
  - 页面方法测试:模拟“朱哥”只买 `朱哥课程`,未买 `未缴费课程`;选中后只出现 `朱哥课程 · 余课 3节`,未缴费课程不出现在 picker 中
  - 页面方法测试:点名页当前课程包无余课时,点击“到课”不会切换成功;有余课时点击“提交点名”能打开确认扣减弹层
  - 本地专项测试:排课课程包过滤、后端排课余额 guard、点名错误文案均通过
  - `node --check` 扫描 `miniprogram` 与 `cloudfunctions` 下 JS 通过
  - `git diff --check` 通过
  - 微信开发者工具 CLI `preview` 通过,包体约 `626.4 KB`
- **部署注意**:
  - 本轮修改后至少需要部署:
    - `cm_batchBalance`
    - `cm_createSchedule`
    - `cm_checkin`

### 追加记录 · 2026-06-17 · 交付前收口与暂停观察
- **当前状态**: 项目先暂停新增开发,进入客户/用户实际使用观察期。后续只根据真实使用中暴露的问题做针对性修复,不要主动继续大改 UI 或重构业务。
- **本轮最终安全与权限修复**:
  - 核实微信云开发官方文档: 事务内不能使用 `where` / `aggregate`,只能做单记录 `doc().get/update/set/remove` 和 `collection.add`。
  - 已移除事务内 `where` 的云函数: `cm_checkin`、`cm_undoCheckin`、`cm_createOrder`、`cm_bindParent`、`cm_verifyInviteCode`、`cm_bootstrapAdmin`。
  - `cm_checkin`: 点名事务内只按文档 ID 重读排课/学员/余额,保留状态校验、课程包余额校验和扣减记录。
  - `cm_undoCheckin`: 撤销点名先在事务外定位 attendance/余额候选,事务内按文档 ID 重读并回滚。
  - `cm_createOrder`: 缴费登记移除事务内余额查询,兼容旧余额记录;新余额记录使用确定性文档 ID,降低并发重复余额风险。
  - `cm_bindParent`: 家长绑定新增 `parent_bind_attempts` 频率限制,同一 openid 1 小时最多 10 次;绑定事务内按学员 ID 重读,保留防并发覆盖。
  - `cm_verifyInviteCode`: 邀请码注册移除事务内查询,邀请码按 `_id` 重读确认;新老师使用确定性文档 ID,降低并发重复注册风险。
  - `cm_bootstrapAdmin`: 首位管理员初始化继续要求 `INIT_SECRET`,并使用固定 `bootstrap_admin` 文档 ID 降低并发重复初始化风险。
  - `cm_initDB` / `cm_clearData`: 已加入 `parent_bind_attempts` 集合创建/清理。
- **管理员识别统一**:
  - 云端管理员判断已和前端/`cm_checkRole` 对齐: 支持 `is_admin`、`isAdmin`、`role/user_role` 为 `admin`、`super_admin`、`principal`、`owner`。
  - 已同步到相关云函数,避免“前端显示校长/管理员,云函数返回无权限”的口径分裂。
- **云端已部署**:
  - 2026-06-17 22:xx CST 使用微信开发者工具 CLI 部署到 `cloud1-d4gerzfz6069ec252`,27 个相关云函数全部 success:
    `cm_addPackage`、`cm_batchBalance`、`cm_checkin`、`cm_createOrder`、`cm_createSchedule`、`cm_deleteStudent`、`cm_generateInviteCode`、`cm_getParentData`、`cm_getPackages`、`cm_getSchedules`、`cm_getStudentAuditLogs`、`cm_getStudentDetail`、`cm_getStudents`、`cm_getTeachers`、`cm_saveFeedback`、`cm_sendNotice`、`cm_stats`、`cm_submitLeave`、`cm_undoCheckin`、`cm_updatePackage`、`cm_updateStudent`、`cm_bindParent`、`cm_verifyInviteCode`、`cm_bootstrapAdmin`、`cm_clearData`、`cm_initDB`、`cm_diagnoseTeachers`。
- **验证已通过**:
  - `find cloudfunctions -maxdepth 2 \( -name index.js -o -name auth.js \) ... node --check` 通过。
  - `node scripts/permission-regression-check.js` 通过 16 项。
  - 新增 `scripts/cloud-safety-regression-check.js`,用于防止事务内 `where`、家长绑定频控、管理员识别口径回退;当前通过。
  - `git diff --check` 通过。
  - 微信开发者工具 CLI `preview` 通过,包体约 `657.7 KB`。
- **交付后处理原则**:
  - 暂停主动新增功能和大范围视觉调整。
  - 客户使用中如反馈问题,先复现、定位、最小范围修复、再部署对应云函数/前端。
  - 不要再绕过云函数直接读写核心业务集合;缴费、排课、点名、撤销、反馈、家长数据均按现有云函数权限链路走。

---

## 禁止行为

- 不要删除 PRD
- 不要随意改数据库字段名
- 不要一次性重构整个项目
- 不要跳过 M1 直接做复杂页面
- 不要把 V2 功能提前塞进 V1
- 不要在前端直接操作多个核心集合完成点名
- 不要绕过云函数做缴费和扣课时
