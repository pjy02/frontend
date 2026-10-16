# Admin Motion 与视觉层级（第二、三步）

## 边界

- Admin 继续使用现有 Theme、Layout、Dashboard、ProTable、统一工作区和移动卡片；不引入第二套页面框架。
- 本次不改 API、Schema、Store、权限、路由、请求条件或后端。
- 共享层只提供 Profile、换算与可选 Context。只有 Admin 根部启用；User Web 没有默认 Profile，也不写入 Admin CSS 变量。
- 保留上一阶段的 `admin-motion-baseline.md` 和捕获脚本，不用本次截图覆盖修改前证据。
- 本步骤统一参数入口与视觉层级；查询意图识别、具体增删/排序编排和更细的页面动效继续按后续阶段处理，不在这里重做业务状态机。

## 单一参数来源

`motion-tokens.ts` 是 Admin 的时长、曲线和运动幅度来源。`MotionProvider` 把同一 Profile 同步给共享 Motion Context，并在绘制前安装 `--admin-motion-*` 变量；偏好变化、Profile 变化时一起更新，卸载时恢复之前拥有的变量和模式。

共享能力位于：

- `packages/ui/src/lib/motion-profile.ts`：毫秒 → Motion 秒、CSS 变量、普通/减少动态效果解析。
- `packages/ui/src/components/motion-profile.tsx`：显式启用的 Provider，未启用时 `useMotionProfile()` 返回 null。

不要在页面重新填入 `duration: 0.18`、`ease: [...]` 等同义参数。示例：

```tsx
const { reducedMotion, presets } = useAdminMotion();

<motion.div
  initial={reducedMotion ? false : { opacity: 0, y: presets.dataEnter.distance }}
  animate={{ opacity: 1, y: 0 }}
  transition={presets.dataEnter.transition}
/>
```

CSS 对应使用 `var(--admin-motion-data-enter-duration)`、`var(--admin-motion-data-enter-ease)` 和 `var(--admin-motion-data-enter-distance)`。修改一个预设即可影响其 CSS/Motion 消费者，无须逐页修改。

### 空间与状态

| 职责 | 预设 | 当前默认 |
| --- | --- | --- |
| 空间：按压 | press | 80ms、scale 0.98 |
| 状态：颜色/透明度 | state | 120ms |
| 菜单/子菜单 | menuEnter / menuExit / submenu | 160 / 120 / 160ms，4 / 2 / 6px |
| 手机菜单分级 | menuLevel | 180ms，进入 20px；退出使用 menuExit 幅度 |
| Dialog 内容 | dialogEnter / dialogExit | 300 / 200ms，8 / 4px |
| 遮罩状态 | overlayEnter / overlayExit | 200 / 120ms |
| 导航/选中/展开/Tabs | navigation / selection / expand / tab | 200 / 220 / 300 / 200ms |
| 数据/重排/分页/批量栏 | dataEnter / dataExit / dataLayout / pagination / batch | 180 / 120 / 220 / 160 / 180ms |
| 更新着色/刷新进度 | feedback / progress | 900 / 1150ms |
| 数值/图表 | number / chart | 580 / 650ms |
| 分类淡出淡入/尺寸 | categoryExit / categoryEnter / categoryLayout | 90 / 180 / 240ms，进入延迟 60ms |
| Tooltip/流量条 | tooltip / rankBar / tooltipBar | 100 / 280 / 360ms |
| 成功图形/成功保留/Loading 周期 | success / successHold / loading | 300 / 420 / 720ms |

以上数值用于说明当前默认，实际代码只以 `motion-tokens.ts` 为准。`successHold` 是请求成功后的保留时间，不是请求超时或业务完成条件；关闭/卸载后不再补发成功计时。未启用 Profile 的共享 ConfirmButton 保持原 420ms 行为。

Recharts 的公开类型只接受命名曲线，因此通过同一配置文件的 `adminChartEasing` 集中适配，不强行传入不受其类型支持的 Motion 曲线。图表几何仍由 Recharts 负责。旧 `--admin-motion-fast/normal/slow/spring` 保留为映射到新语义的兼容别名；`spring` 是历史名称，不是物理弹簧。

### 减少动态效果

- 所有解析后的预设时长与延迟为 0，距离为 0、缩放为 1。
- JS 组件关闭布局插值、位移入场，指标立即呈现最终值；CSS 同步取减少动态效果值。
- CSS 仍保留系统媒体查询及根模式兜底，以极短的终态过渡保证浮层生命周期；不靠动画结束改变业务结果。
- Loading 文本、aria-busy、错误、成功提示与键盘焦点仍然工作，不以持续运动作为唯一反馈。

## 几何控制权

- 普通行、卡片重排：Motion；CSS 只负责背景/轮廓与反馈着色。
- 可拖动行/卡片：DndKit 独占 transform，过渡时长/曲线读同一 dataLayout 预设；Motion 仅处理透明度。
- 菜单：Radix 负责定位、碰撞和焦点，CSS 负责内容层进入/退出。Admin 子菜单放独立 Portal，避免被父级 overflow 裁切；未修改共享 DropdownMenu 或 Header 的 DOM/样式。
- 手机面板：Vaul 负责外壳和手势；Motion 只处理内部分级，减少动态效果时不做布局插值。
- 不为提取参数改实体 key、页面 key、请求、缓存、分页或滚动恢复。

## 不依赖动画的视觉层级

Admin CSS 中集中维护：

| 内容 | Token | 默认字号 |
| --- | --- | --- |
| 页面标题 | --admin-type-page | 24px |
| 工作区/确认标题 | --admin-type-workspace | 18px |
| 分区/卡片标题 | --admin-type-section | 16px |
| 字段标签/正文 | --admin-type-label / body | 14px |
| 辅助说明 | --admin-type-description | 13px |
| UID/SID、排行元数据、状态标签 | --admin-type-meta | 12px |

- 错误内容保留正文 14px，不缩成弱化的元数据。
- Dashboard、用户卡片的重要 10–11px 内容提升至 12px；不全局覆盖图标尺寸或 User Web。
- 服务器协议保留外层 Accordion，内部 fieldset 改为细分隔线与 legend，不再嵌套带底色的边框卡片；字段布局、表单路径及指纹数据均不变。
- 用户基本信息、通知和认证三个活动分区取消重复外框/底色；开关行使用分隔线，不在每个控件外叠一张卡。
- 页面创建、工作区保存仍为主要操作；ProTable 行内快捷按钮降为文字/状态层，入口仍保留。Portal 中的保存按钮不继承行内弱化样式。
- 普通状态保留文字 + 状态点/图标 + 色彩。流量增长/下降使用正负号、方向箭头、信息色/中性色，不再暗示成功/故障；真正的服务健康仍可使用成功/警告/危险语义。

## 验证与证据

新建 `scripts/check-admin-motion-browser.mjs`，只允许本机预览和 Mock，非 GET 业务请求拦截并使测试失败。输出已有 report.json 时拒绝覆盖。

默认覆盖 390、430、768、1024、1280、1440px × 英文浅色普通模式 / 中文深色减少动态效果，共 12 组。验证：

- CSS 模式与参数；动态切换减少动态效果后 CSS/React 同步。
- Dashboard 字体层级与流量状态语义。
- 桌面子菜单中心实际命中，不能只检查 DOM 存在/isVisible；手机使用内部分级。
- 用户资料无重复卡片外框、透明底色、活动区一个主要保存操作。
- 协议 fieldset/legend、错误定位标记、标签/工作区字号保留。
- 商品价格分区、手机工作区、各记录状态无视口级横向溢出。

每组保存 Dashboard、日志子菜单、用户资料、协议分区、商品价格 5 张截图。使用固定浏览器时钟与帧等待。这是本地 Mock 与代表性界面验证，不代替真实后端、实体低性能手机帧率或全站所有状态组合验收。

### 本次检查（2026-10-16）

| 检查 | 结果 |
| --- | --- |
| Admin 全量 Vitest，`--maxWorkers=1` | 52 个文件、234 项通过；包括 Schema/指纹、菜单键盘与三级、未保存保护、钱包更新、Locale、UI 保护合同 |
| 共享 UI Vitest | 8 个文件、39 项通过 |
| User Vitest | 17 个文件、81 项通过 |
| Admin / User TypeScript | `tsc --noEmit` 通过 |
| 本次相关源码与浏览器脚本 Biome | 29 个文件通过；新增浏览器脚本 Node 语法通过 |
| Admin / User production build | 通过；既有 eval / 大 chunk 警告保留，不顺带改构建策略 |
| 浏览器 | 最终 12/12 组通过，60 张截图，0 pageerror，0 业务写请求 |
| 最终差异 | `git diff --check` 通过；接口、语言键、User 源码、共享 globals、Layout、Store、路由、依赖均无改动 |

浏览器最终目录名 `motion-phase23-025a106-final`，使用 `report.json` 记录实际结果。最初一轮在 CSS 压缩将 `0.75rem` 规范化为 `.75rem` 时被字符串断言拦住，已改为比较数值及单位；没有为了通过检查改变 UI 字号。中间的手机/桌面冒烟目录独立保留，不覆盖最终矩阵或第一步基线。

曾在构建、类型检查和测试同时运行时遇到原有 5 秒测试超时；不修改业务或测试阈值，最后分开串行重跑。jsdom 的样式解析提示及故意注入的接口错误日志不等于浏览器 pageerror；实际浏览器单独校验。

改动保持在原 `main@025a106` 工作区，未建分支、提交或推送。上一阶段的两个未跟踪文件完整保留；本阶段的源码、测试、实施说明及新浏览器脚本另行新增/修改。

## 第四步：表格操作原因与定向反馈

- `ProTableActions.refresh({ reason, rowIds })` 区分业务修改与查询；不传参数仍为普通刷新。记录上一次成功请求的筛选/分页快照，查询改变时优先按查询处理，不将跨页记录识别为新增。
- 创建/编辑只提示已知目标；接口不返回创建 ID 时，只允许唯一且有实体 ID 的新增记录轻提示，多条不确定结果不猜测。记录不在当前结果内时沿用原有 Toast，不跳页寻找、不伪造占位行。
- 删除只有明确 ID 的目标退出，其他查询移除立即完成。空结果也保留 AnimatePresence 容器；普通行由 Motion 补位，可拖动行由 DndKit 的布局测量/过渡补位，后者不使用 Motion layout/scale/y。
- 删除桌面/手机结果区的分页 key；保留成功刷新前后的实体 DOM、行内工作区和未保存输入。结果区仅在分页/筛选返回时做短透明度反馈，可中断、不逐行延迟。
- 批量栏 key 保持固定，只有零到非零选择才入场，数量/Loading 更新不重新挂载。取消每行长期的 will-change，避免所有可见记录常驻合成层。
- 用户、订阅、服务器、节点、商品、订单、优惠券、支付、公告、广告、文档、佣金审核、工单、客户端与营销任务使用明确操作原因。优惠券批量删除改为定向刷新，不再顺带清空筛选/个人列设置。
- 不增加排序请求参数，不修改 API、Schema、Zustand、URL 同步、保存视图或滚动恢复的实现。

## 第五步：Dashboard 连续性

- `useDashboardCategory` 是类别切换的唯一时钟：当前类别整体淡出后，提交最新目标，再统一淡入；新操作取消旧动画，不保存待播放队列。摘要/列表使用同一 opacity MotionValue，全站总量、控制区与卡片外框不参与类别淡入淡出。
- 类别内容快照包含数据、日期与实体类型，避免淡出期间旧节点数据套上新的周期标签。今天/昨天保留实体 key，不再重新创建整组；数字从当前显示值继续，横条只改变宽度，排名由 Motion position 布局过渡。
- 内容高度由独立 `DashboardHeightRegion` 测量自然布局并插值，不对文本缩放；连续改变行数时从当前高度转向最新高度；减少动态效果时自然布局立即更新。
- Tooltip 不再用日期、流量或邮箱作为 key；邮箱完成只更新文本。首次悬停短淡入，Radix 的 instant-open 连续悬停直接展示，不做每条流量条从零生长。图表 Tooltip 数据点移动直接更新内容，禁用 Recharts 的指针位置追赶动画。
- 图表数据按来源 list 记忆化，范围切换不换组件 key。首次首绘使用 chart 预设，后续几何插值使用 dataLayout；展开视图直接展示已有曲线。两种视图共享图例显隐，保留当前范围与数据。
- 请求失败且存在旧数据时保留图表与排行，由已有 freshness 信息说明失败；空数据与不可用状态区分，并保留结果区最小空间。

### 第四、五步验证方式

- 新增表格交互测试：普通刷新/编辑/创建/删除、分页/筛选区域身份、并发请求最新结果、失败保留旧值、批量栏节点身份；保留原有未保存表单、URL 恢复及保存视图测试。
- Dashboard 测试覆盖快速类别切换、数值中断、详情邮箱完成的 DOM 身份、图表范围与展开图例状态、减少动态效果。
- 新增 `scripts/check-admin-data-continuity-browser.mjs`。仅允许本地 Mock/预览，禁止所有业务写请求；六种宽度 × 英文浅色普通/中文深色减少动态效果，检查实际 Tooltip/触屏详情、类别时钟、周期身份、图表展开、失败刷新、分页和未保存工作区。输出新目录，不覆盖前面阶段的视觉基线。

浏览器检查补充：Chrome 在移动已有 DOM 排名行时也可能重播其 CSS Animation，不能只凭实体 key 相同就断言不重播。因此流量横条的首次淡入/scaleX 改由持久 Motion 节点负责，CSS 只负责横条与分段宽度；周期切换同时验证实体 DOM 身份和横条没有回到入场缩放。普通刷新不播放横条入场。

共享 Tooltip 增加默认关闭的 `sharedProvider` 选项，排行显式共用一个 Provider，才可复用 Radix 的跨项 skip-delay；保留原有可悬停内容与键盘行为，其他地方与 User Web 不改变默认。浏览器用连续鼠标轨迹验证跨项，而不是在旧浮层 hover-grace 区域只发送一个 synthetic hover 事件。

测试夹具补充完整的 all-time 曲线，仅作用于本地浏览器拦截数据；原通用 Mock 只有 all-time 合计时，不能拿它来断言范围切换后仍有曲线。没有为通过测试伪造线上空数据，也没有更改后端请求/返回合同。

### 第四、五步最终结果（2026-10-16）

| 检查 | 结果 |
| --- | --- |
| Admin 全量 Vitest（串行 worker） | 54 文件 / 245 项通过；浏览器发现横条问题修复后，再定向复验 5 文件 / 20 项通过 |
| 共享 UI Vitest | 8 文件 / 47 项通过 |
| User Vitest | 17 文件 / 81 项通过 |
| Admin / User TypeScript | 最终 `tsc --noEmit` 均通过 |
| 本工作区相关源码 Biome | 48 文件通过，最终检查未自动修复；新浏览器脚本另经相同配置 stdin 检查与 Node 语法检查 |
| Admin / User production build | 均通过；保留既有 eval / 大 chunk 警告 |
| 最终浏览器矩阵 | 12/12 通过，84 张截图，0 pageerror，0 业务写请求 |
| git diff --check / 冲突检查 | 通过，无未解决合并或冲突标记 |

最终浏览器目录 `motion-phase45-025a106-final/report.json`，覆盖 390、430、768、1024、1280、1440px × 英文浅色普通动画 / 中文深色减少动态效果。手机与桌面详情、展开图表和未保存工作区截图已人工抽查。中间冒烟目录独立保留，不覆盖第一步基线；没有把失败的中间报告当作最终通过证据。

首次全量中，新数字中断测试错误假设 React rerender 不会推进动画帧；修正为验证从当前值继续、不会归零且最终到达最新目标，完整重跑后通过，没有修改动画时长或测试超时阈值。jsdom 原有 CSS 解析提示和故意注入的请求错误仍与真实浏览器异常分别记录。

User 页面/样式、服务客户端、Store、路由、Schema、语言键与依赖文件均未修改；共享 Tooltip 的新 Provider 用法仅由 Admin 排行显式启用。本机预览与 Mock 已停止。当前仍为 `main@025a106` 的未提交工作区，保留前面阶段所有已有改动，未建分支、提交或推送。真实后端联调、实体低性能手机帧率与全站全状态笛卡尔积不在本次 Mock 验证结论内。

## 第六、七步：导航、展开与保存反馈（2026-10-16）

### 导航和 Tabs

- 新增 `AdminPageTransition`，由组件的临时 Web Animations 效果独占页面内容 opacity/translation，参数仍取 MotionProfile；Layout 不再通过 key 重建 Outlet 外层。工作区根路径沿用原有归一化，打开/关闭服务器或商品编辑不重播底层列表。效果结束自动释放，切换/卸载时 cancel，不写入永久内联 transform/opacity。
- 页面焦点只在主页面切换时移动；已打开 Dialog 的焦点交给弹层管理，不抢回 main。
- 同一个页面身份不因 Suspense 恢复或 profile 重配置重复入场；取消效果后恢复默认可见样式。浏览器截图前等待实际动画结束，并检查内容 opacity，而不只断言 DOM 存在。
- Sidebar 初次有效测量和布局模式变化时不从零矩形飞入；移除选中背景的长期 will-change，保留 CSS 对几何过渡的所有权。
- 真实折叠检查发现 HoverCard/Tooltip 的 asChild 会覆盖按钮 data-slot，原测量选择器会找不到激活项。指示器改用稳定的 data-sidebar 标记，展开和折叠共用同一身份。
- Tabs 指示器取消等宽/nth-child 的六项上限，实际测量 offset 几何，兼容不等长文字、横向滚动与手机布局。仅 MotionProfile 存在时启用测量，CSS 负责过渡；Dashboard 类别切换仍使用原有专用指示器，不新增第二块背景。
- 商品表单显式使用 `preserveContent`：第一次访问时才挂载，访问后保留隐藏页签的输入实例；隐藏区域不可见、不可 Tab 进入。普通数据页签及 User Web 默认不启用持久内容，避免后台查询扩张。

### 弹层、表单和异步反馈

- 保留既有 Dialog/Popover/Menu 的语义 Tokens、Radix Presence 与定位层，不再叠加第二套入场 transform；Accordion 继续仅展开当前分区。
- 手机菜单外壳由 Vaul 管理，内部层级只用 Motion 控制 x/opacity；容器按实际高度过渡，不用 layout 缩放文字。退出层级及关闭中的面板 inert，键盘仅遍历当前层。
- 手机 Esc 逐级返回，返回时恢复刚才的分类按钮；面板关闭不提前重置到根层，也不运行遗留的聚焦帧。
- 操作项使用同步 ref 防止同一帧重复执行，异步期间统一 busy/Loading；拒绝后恢复可重试并提供 Locale 错误反馈。同步打开确认 Dialog 的操作仍同步调用，不改变原业务时序。
- ConfirmButton 成功保持时间来自 profile，计时器随关闭、卸载或减少动态效果变化清理，避免旧计时器误关新弹窗。请求未完成不显示成功，失败恢复重试。
- 错误摘要使用持久 grid region 展开/收起，隐藏时 aria-hidden/inert；旧错误仅保留作退场内容，不成为可点击隐藏操作。
- 错误定位按 Radix Tabs 支持的键盘激活协议先打开页签，再逐层打开分区并聚焦字段；不再依赖无效的 `.click()`。聚焦帧随关闭/卸载取消，快速定位以最新目标为准。
- 未保存确认取消后恢复原关闭/提交入口焦点并 preventScroll；不把密码、私钥或 Token 持久化到浏览器存储。

### 第六、七步验收边界

- 新增导航/页签 6 项交互测试，补充手机逐级 Esc、异步失败重试、隐藏页签错误定位、保留编辑焦点以及旧成功计时器清理测试。
- Admin 阶段中全量 55 文件 / 257 项通过；末次页面动画修复后，定向 5 文件 / 39 项通过。末次修复后未再次完整重跑 Admin 全量，剩余全站验收归第八步。共享 UI 8 文件 / 47 项、User 17 文件 / 81 项通过。
- Admin/User production build 通过，仍有原有 eval 与大 chunk 警告；TypeScript、相关源码 Biome 与 diff 检查单独记录。
- 新增 `scripts/check-admin-navigation-browser.mjs`，只允许本机预览与 Mock，阻止所有业务写请求。检查页签实际尺寸、表单 DOM 保留、工作区列表身份、确认取消焦点、多级菜单中间帧、逐级返回及 Sidebar 折叠对齐；不覆盖前面阶段基线。
- jsdom 不播放 Vaul CSS 退场，单测验证 closed 状态；真实 DOM 退场与焦点恢复由浏览器验证，不能仅因 jsdom 未触发 animationend 判定关闭失败。
- 不将这一阶段的定向矩阵当成第八步的全站性能、真实后端或实体手机验收。保持 `main`，没有提交或推送。

最终结果：Admin/User TypeScript、Admin/User production build、14 个本轮相关源码的 Biome、浏览器脚本语法和 `git diff --check` 均通过。最终浏览器报告为 `motion-phase67-025a106-final-r6/report.json`：六种宽度 × 英文浅色普通/中文深色减少动态效果，12/12 通过、60 张截图、0 页面异常、0 业务写请求。手机菜单关闭后的实际内容和桌面 Sidebar 恢复截图已人工抽查。先前目录为中间诊断证据，不作为最终通过报告。

截图抽查曾发现 DOM 存在但普通动效使内容留在透明状态；页面效果改为不写永久内联样式的临时 Web Animations，并增加同页不重播保护。验收新增实际 opacity/display 和动画结束检查，不再仅靠节点存在。所有本轮新增浏览器检查都仅使用本地 Mock；实体手机性能和真实后端仍未验证。本机测试服务在验收后关闭，临时格式配置及 Chromium 调试日志已清理，保留之前全部工作区修改。

## 第八步：性能与完整验收（2026-10-16）

### 本阶段实际修改

- `AnimatedNumber` 不再每帧 setState。动画仍从当前显示值接续、随目标变化取消旧动画；逐帧只修改独占的可视文本节点，格式化结果未变化时不写 DOM。屏幕阅读器保留独立的目标值，不朗读每个中间数字。格式变化即时应用，切换减少动态效果立即到达目标。
- ProTable 记忆列定义；普通刷新没有记录反馈时不创建清理计时器，不为相同空反馈制造额外 render。Admin 显式启用 Profile 时，JSON 内容相同的记录复用引用，操作区按记录、render 回调、标签和配置进行细粒度复用；变更记录和替换后的回调仍正常更新。不是请求缓存，也不跳过后台刷新。
- 不启用 Profile 的 User Web 不启用记录与操作区的这一优化，保留原有默认行为。不修改客户端、请求合同、Schema、Store、权限或路由。
- 删除流量排名行长期 `will-change: transform`。菜单内部层级仅在面板存在时提升，不将整个列表或页面长期提升。高度测量继续由当前内容 ResizeObserver 负责，不增加逐帧全列表测量，也不让 DndKit 与 Motion 同时控制拖动位置。
- 沿用统一减少动态效果解析：空间位移、缩放、排名布局与数值追赶立即结束；Loading/错误/旧数据说明和无障碍状态保留。测试覆盖运行中切换偏好、最新目标优先和旧动画清理。

### 可复现性能测量

新增 `scripts/measure-admin-motion.mjs`：只允许本机预览与 Mock，拒绝业务写请求；390/1440px × 普通/减少动态效果；每种组合执行 3 次周期切换和 3 次 100 行用户列表普通刷新，共 24 个样本。通过 CDP 施加 4 倍 CPU 限速，记录脚本、布局、长任务、矩形测量与空闲 `will-change`。比较使用本步骤修改前后的 production build，同一夹具和脚本，不在测量时并行跑其他构建或浏览器任务。

数值单测使用 React Profiler，32 个计数器并行：初次计数过程的额外 React 提交 **864 → 0**，目标更新 **992 → 32**（32 次来自 props 更新本身），不再每帧提交 React 子树。保留格式更新、中断、最终值和减少动态效果测试，不用脆弱的绝对耗时作为单测门槛。

以下为每组 3 个样本的平均 CDP 脚本时间，单位 ms，包含交互采样窗口内的工作，不等同于单帧时间或网络延迟：

| 场景 | 修改前 | 修改后 |
| --- | ---: | ---: |
| 390px，普通，排行周期切换 | 1145 | 673 |
| 390px，减少动态效果，排行周期切换 | 960 | 561 |
| 1440px，普通，排行周期切换 | 1204 | 812 |
| 1440px，减少动态效果，排行周期切换 | 557 | 628 |
| 390px，普通，100 行刷新 | 6418 | 1264 |
| 390px，减少动态效果，100 行刷新 | 5470 | 1114 |
| 1440px，普通，100 行刷新 | 4845 | 1251 |
| 1440px，减少动态效果，100 行刷新 | 3076 | 1009 |

排行普通模式矩形读取仍为每个采样窗口 48 次，减少模式 16 次，没有因文本优化增加布局测量；普通模式排行布局时间均值 390px **228 → 162ms**、1440px **196 → 158ms**。空闲排行常驻 will-change 元素 **4 → 0**。

不能据此承诺中低端手机 60fps：4 倍限速、100 行压力下仍存在长任务；1440px 减少动态效果的排行脚本耗时有波动，不能写成所有场景全面提速。报告中的 RAF 帧分位数样本较少，部分窗口没有有效帧间隔，不用它推导实体设备帧率。后续如需优化超长列表首次挂载，应另立虚拟化/工作区延迟挂载任务，不能为缩短本次计时破坏已打开的编辑状态。

原始证据目录（位于本任务 visualizations 输出目录，不入仓库）：

- `motion-phase8-performance-before-r2/report.json`：修改前完整采样。
- `motion-phase8-performance-after-final/report.json`：最终实现完整采样。
- 中间 `before`、`after` 和 `smoke` 目录是诊断记录，不冒充最终报告，也不覆盖第一步视觉基线。

### 代码检查

- Admin Vitest：**56 文件 / 263 项通过**；共享 UI：**8 文件 / 47 项通过**；User：**17 文件 / 81 项通过**。
- Admin / User `tsc --noEmit`、production build 通过。
- Biome 对 Admin、共享 UI、User 全部源码检查：**515 文件通过**。新增独立浏览器/性能脚本另做 Node 语法检查；仓库 Biome 默认只包含 src 等白名单，不能把被排除的脚本写成已通过相同 Biome 扫描。
- Swagger 合同 / OpenAPI 来源 Node 测试 **2 项通过**，没有运行生成器。
- Functions 代理测试 **8 项通过**；受限环境无法连本机临时服务器，改在本机环境重跑通过，没有修改代理代码。
- Docs 构建通过；VitePress 本地 Vue 链接需要在本机环境创建。保留原有字体资源、代码语言、eval 与大 chunk 警告，不将警告误报为构建失败，也不顺带改打包策略。

### 最终浏览器结果与边界

| 最终报告目录 | 范围 | 结果 |
| --- | --- | --- |
| `motion-phase8-025a106-final` | 六尺寸 × 中英文 × 浅深色 × 普通/减少动态效果；Dashboard、用户长列表状态、菜单、服务器编辑返回和批量栏 | 48/48，384 张截图 |
| `motion-phase8-navigation-final` | 六尺寸 × 英文浅色普通/中文深色减少；商品表单 Tabs、服务器未保存确认/焦点、Sidebar 与菜单逐级返回 | 12/12，60 张截图 |
| `motion-phase8-continuity-final` | 同样六尺寸与两组偏好；鼠标 Tooltip、触屏详情、快速类别/周期切换、邮箱加载、图表展开、旧值保留、分页与行工作区 | 12/12，84 张截图 |
| `motion-phase8-visible-frames-final-r2` | 六尺寸与两组偏好；排行滚入视口后的真实中间帧、最新类别和运行中切换减少动态效果 | 12/12，24 张截图 |

共 84 组定向场景、552 张截图和 2 段录屏，0 pageerror、0 业务写请求。完整组合矩阵是第一行的 48 组，后 36 组是更深入的行为补充，不声称全站每个页面、每个状态都执行了笛卡尔积测试。截图检查实际 opacity/display、动画结束与页面横向溢出，不仅检查节点是否存在。

- 用户列表覆盖正常、延迟加载、空数据、首次错误、无权限、刷新失败仍保留旧值、长邮箱与 50 行；100 行另做性能压力测量。
- 菜单覆盖键盘 Enter、方向键、逐级 Escape、返回焦点；触屏详情使用实际浏览器触摸输入。桌面悬停在连续移动中检查 Tooltip 数据更新，手机不依赖 hover。
- 排行类别快速切换以最新目标为准；周期切换保留实体/横条身份；图表范围、展开和图例状态保留。服务器编辑取消后保留列表 DOM、筛选和实际滚动偏移；商品页签保留已访问输入。
- 中间帧专项每组采到约 23–27 帧，普通动画包含 0 与 1 之间的实际透明度，相关五块区域同步；减少模式采样透明度恒为 1、transform 为 none。运行中改变系统偏好后，类别内容恢复可见且高度样式清理。控制区和不变的全站总量不随类别淡出。
- 人工抽查了手机长文本、中文深色错误状态、桌面旧数据提示、手机和桌面可见排行中间帧。第一次矩阵的部分手机中间截图只露出控制区，因此另补可见帧专项；保留旧报告，不用最终截图代替中间过程证据。
- 原 `main@025a10680fd370d2236ca29db554562430f8e5d5` 与之前工作区修改保持不变；无未解决冲突或冲突标记，`git diff --check` 通过。User 源码、服务客户端、Store、路由、Schema、依赖和文档构建源文件未新增差异。没有临时分支、提交或推送。

真实后端联调、实体手机/平板性能、Safari/Firefox 和真实触摸硬件未验证；本地 Chromium 的视口/触摸/CPU 模拟不能替代它们。只承诺上述覆盖范围内未发现 UI/行为退化，不能把 Mock 测试写成真实后台业务已验收。既有 eval、大 chunk 与超长列表首次挂载成本仍属于后续风险。

验收后已关闭本轮启动的本机 Mock 和预览进程；没有遗留临时格式配置或 Chromium debug.log。保留原有及本阶段所有源码、测试与证据，未执行提交或推送。

## 最终推送前复验（2026-10-16，用户明确授权提交及推送）

- 刷新 `origin/main` 后确认仍与本地 `main@025a106` 一致，无远程新增提交；目标仅为 `https://github.com/pjy02/frontend.git` 的 `main`，不创建分支，不推送 upstream。
- 重新完整执行 Admin **263**、共享 UI **47**、User **81** 项 Vitest；全部通过。重新执行全部独立工作流/Swagger/OpenAPI Node 测试 **23 项**、Functions 代理 **8 项**；全部通过。本机服务器相关测试在受限环境因 EACCES 失败，换到本机环境通过，不修改业务以绕过环境限制。
- Admin/User TypeScript、515 文件源码 Biome、Admin/User/Docs production build 和 `git diff --check` 通过；保留前述既有构建警告。
- 最新动效/状态脚本六尺寸 × 英文浅色普通/中文深色减少模式 **12/12** 通过，96 张截图，0 页面异常、0 业务写请求。报告：`motion-prepush-acceptance-final/report.json`。
- 扩展响应式脚本覆盖服务器、节点、用户、商品、订单、优惠券、支付、工单、订阅日志、服务器表单与平板排序。最终 **12/12** 通过，0 页面异常，4 次排序 POST 仅发送给 Mock。报告：`motion-prepush-tablet-final-r2/report.json`。
- 扩展脚本初轮 768px 中文深色遇到 Mock 读取 ECONNRESET，旧 route 回调直接抛出导致用例结束后还有 unhandledRejection。修复测试脚本：错误收集后明确 abort、保存 JSON/未完成请求诊断、固定日期、禁止覆盖旧证据、Mock 请求超时并仅对 GET 连接重置允许重试 1 次；排序或其他写请求不重试。全部六尺寸重跑通过，失败的初轮证据保留，不混入通过报告。正式前端请求、后端接口均没有为此改变。
- 人工复核了此前失败位置的 768px 中文深色用户卡片，加载完成、布局与字段显示正常。真实后端和实体低性能设备仍未验证，不能将本机通过结论扩大到这些环境。
- 本节是待发布快照的验收记录，实际提交及远程 SHA 以 Git 推送后核对结果为准。测试服务已关闭，全部前序 UI 改动保留。
