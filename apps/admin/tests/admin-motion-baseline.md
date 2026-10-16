# Admin 动效精修：第一步基线与职责

## 1. 范围与版本

- 基线：`main@025a10680fd370d2236ca29db554562430f8e5d5`。
- 开始检查时工作区干净；本地 `HEAD`、`origin/main` 与本次查询的远程 `refs/heads/main` 一致。
- 本阶段只新增本文件和 `scripts/capture-admin-motion-baseline.mjs`，不改运行时代码，不建分支，不提交、不推送。
- 目的：记录现有能力，划分动画范围和唯一控制方，列出后续保留、调整、移除项；不是重做动效基础设施。
- 下述“代码发现”来自当前源码；“浏览器记录”只证明本地 Mock 下的静态终态与计算样式，不代替动画中间帧、真实后端或实体手机性能验收。

## 2. 五类界面现状

| 界面 | 已有实现 | 后续要核对的衔接 | 必须保留 |
| --- | --- | --- | --- |
| Dashboard | 指标旧值过渡、图表绘制、排行分类 Fade-through、排行位置变化、Tooltip、手机流量详情工作区 | 数字 580ms、图表 650ms、分类内容约 240ms，分别定义；摘要、列表与 Tooltip 有不同切换 key，应按数据关系统一，不是全部改成一样长 | 当前布局、组件个性化、邮箱后台预取、UID/SID、排行口径、独立数据新鲜度与失败后旧数据 |
| 用户列表 | ProTable 保留旧行刷新、顶部进度、分页方向、普通行/卡片位置动画、修改着色、批量悬浮栏 | 目前行差异判断未区分筛选、分页与真实创建，切换查询可能被标为新增；旧数据刷新已有能力，不重复实现 | URL 条件、列/密度/保存视图、分页滚动恢复、平板布局、稳定行操作 renderer |
| 服务器配置 | 服务器协议编辑、节点继承配置均在统一工作区；Accordion、表单错误、未保存保护已有实现 | Dialog 入场、内部 Accordion、错误展开由不同层负责；不能因保存刷新或分区展开重播整个工作区 | 协议 Schema、Reality 指纹、继承摘要、未保存保护、错误定位、手机全屏、DndKit 排序 |
| 商品表单 | 统一工作区、基本资料/价格 Tabs、表单保护与固定操作区 | 通用 Tabs 内容目前是单向短位移入场，并非完整交叉切换；不能以重建表单实现过渡 | 草稿输入、表单实例、校验、保存逻辑、工作区路由和列表返回位置 |
| 多级菜单 | 桌面 Radix 菜单，手机 Vaul 分级面板；宽度、触摸、返回、焦点与减少动态效果已有规范 | 浏览器确认桌面子菜单被父层裁切，需先修复挂载边界；定位 wrapper 和内容动效不能共用 transform；手机手势外壳与内部层级位移必须分开 | 当前分组、确认 Dialog、日志参数、焦点恢复、手机不横向飞出、Header 普通菜单不受影响 |

主要证据入口：

- 全局：`apps/admin/src/components/motion-provider.tsx`、`apps/admin/src/styles/admin-theme.css`。
- 导航：`apps/admin/src/layout/index.tsx`、`apps/admin/src/layout/sidebar-left.tsx`。
- 数据：`packages/ui/src/composed/pro-table/pro-table.tsx`、`data-continuity.ts`、`sortable-mobile-card.tsx`（后两者同目录）。
- 仪表盘：`apps/admin/src/sections/dashboard/components/dashboard-motion.tsx`、`statistics.tsx` 和 `apps/admin/src/sections/dashboard/dashboard.css`。
- 弹层与表单：`apps/admin/src/components/workspace-dialog.tsx`、`form-safety.tsx`；`packages/ui/src/components/dialog.tsx`、`tabs.tsx`。
- 操作菜单：`apps/admin/src/components/admin-action-menu.tsx`，已有视觉与交互合同见同目录 `admin-action-menu.md`。

## 3. 现有时序清单，不作为本阶段的新实现

| 机制 | 当前值/行为 | 结论 |
| --- | --- | --- |
| CSS Tokens | 80/120/200/300ms；标准、进入、退出曲线；菜单 160/120/180ms | 保留 Tokens，后续补充语义职责；不再建设第二套 Provider |
| MotionProvider | 默认 200ms、`[0.2, 0, 0, 1]`；统一 reduced-motion | 保留。组件内显式 transition 会覆盖默认值，不能只调 Provider 就声称全站统一 |
| `--admin-motion-spring` | 实际是 cubic-bezier，不是物理弹簧 | 后续明确命名/语义，避免将它与真实 spring 当作同一种控制器 |
| 页面内容 | CSS 200ms，透明度 + 4px 位移 | 只导航内容区；服务器/商品工作区已有稳定的页面 key，禁止破坏 |
| Sidebar | 外框 300ms；选中背景 transform 300ms、尺寸 200ms；分组 grid 展开 300ms | 保留测量 + CSS 职责；核对初次测量不从零位置“飞入” |
| Dialog | 内容开 300ms / 关 200ms；遮罩开 200ms / 关 120ms | 后续按确认、CRUD、复杂工作区的语义统一；Radix 继续管理存在性和焦点 |
| 菜单 | 桌面开 160ms / 关 120ms；手机层级 180ms | 保留当前空间方向，提取重复参数；不能覆盖定位 wrapper |
| Tabs | 通用 CSS 指示器按子项等分；内容 200ms 从侧面进入 | 后续核对长标签与非等宽 Tabs，不把入场误称为交叉切换 |
| 表格 | 普通行/卡片约 180ms，布局 220ms；修改着色 900ms；刷新进度循环 1.15s | 保留连续性；先区分操作意图，再决定新增或更新反馈 |
| Dashboard | 数字 580ms；图表 650ms；分类退出 90ms、进入延迟 60ms + 180ms；容器尺寸 240ms | 已经有 Fade-through，不从零重写；统一同一操作下各层的时间关系 |
| 按钮 | 状态层、按压 scale 0.98、Loading、成功反馈已有实现 | 保留可操作反馈，后续审查成功计时及卸载清理，异步完成不由动画计时决定 |

## 4. 十类操作的范围与固定区域

下表“调整目标”为后续实施约束，本阶段不更改任何交互。

| 操作 | 当前入口/机制 | 允许动画的范围 | 必须保持不动或保留的状态 | 决策 |
| --- | --- | --- | --- | --- |
| 导航 | Layout 的内容 wrapper、pathname key、主区焦点 | 新页面内容短过渡；Sidebar 独立表达选中位置 | Header、Sidebar 外壳、页面滚动恢复；子路由工作区不重播底层列表 | 保留稳定 key，审查重复入场 |
| 刷新 | Query/ProTable 原数据 + 局部忙碌状态 | 顶部进度、更新时间、确实变化的值/行 | 旧数据、容器尺寸、工具栏、分页、滚动、焦点 | 保留旧数据，禁止每次刷新重挂整页 |
| 筛选 | URL 同步、回第一页、移动筛选工作区 | 列表内容短切换，局部 Loading | 已选条件、表头/工具栏、列设置；校验失败不请求 | 调整：不能把查询结果当新建成功 |
| 分页 | page direction + 内容容器 key | 当前页行/卡片，短方向提示 | 页容量、筛选、工具栏、批量栏固定位置 | 保留，避免叠加“新增”着色 |
| 排序 | 普通位置布局；拖动排序走 DndKit | 同组同 ID 的行位置；拖动时仅 DndKit 控制坐标 | 列宽、选中状态；不同查询/实体不伪装成同一行移动 | 普通排序与拖动分责，保留已有拖动修复 |
| 创建 | 新建工作区 + 提交后列表刷新 | 提交按钮、成功消息、真实新增行 | 提交前字段内容、错误信息；不强制把列表滚回顶部 | 后续增加明确 mutation 意图，不能仅靠数组差异 |
| 编辑 | 统一工作区、提交反馈、行内容差异 | 提交状态和相关行/字段更新 | 列表位置、表单实例、其他行和其他查询缓存 | 保留局部刷新及 FormSafety |
| 删除 | 独立确认 Dialog + 异步请求 | 确认按钮状态、成功后被删行退出和余下行补位 | 请求未成功不提前删；失败保留对象和重试能力 | 保留确认，审查退出与重排的双重位移 |
| 展开 | Accordion、Tabs、Sidebar 分组、菜单层级 | 当前分区/面板的尺寸或透明度 | 表单值、输入焦点、未展开区域；不制造横向溢出 | 单一区域单一几何控制方 |
| 保存 | FormSafety、Loading、成功/失败提示 | 按钮状态、错误摘要展开、保存后局部数据 | 失败保留所有输入；敏感字段不写 localStorage；焦点恢复不受动画结束影响 | 保留保护，后续统一成功节奏和计时清理 |

## 5. 唯一负责人：按 DOM 层及属性划分

允许父子节点使用不同机制；禁止同一个节点的同一几何属性由多个机制同时写入。业务状态和布局测量不是第二个动画引擎。

| 元素/层 | 唯一控制方 | 其他层的职责及禁区 |
| --- | --- | --- |
| 页面内容 wrapper：opacity/transform | Admin CSS | Router 只决定内容与稳定 key；不再套第二层 Motion 入场 |
| Sidebar 外框：宽度/位置 | Sidebar CSS | React 只切换状态；不再用 Motion 同时插值其 width/left |
| Sidebar 选中背景：位置/尺寸 | Admin CSS transition | JS 仅测量并写目标变量，不能再逐帧写 transform |
| Sidebar 分组：grid 行高/透明度 | Admin CSS | React 控制展开、`inert` 和 aria；不另套 height 动画 |
| 通用 Tabs 指示器 | Admin CSS 伪元素 | 后续如增加测量，JS 只提供目标位置/宽度；不得另加相同层的 layoutId |
| Dashboard 分类 Tabs 指示器 | 现有 Motion layoutId | 与通用 Tabs 是不同元素，不能让 CSS 伪元素重复画一个背景 |
| Tabs 内容 | 现有 Admin CSS；后续如更换应整体交接 | 保留业务表单实例，不同时执行旧 CSS 入场和新 Motion 位移 |
| 桌面 Menu/Tooltip/Popover 定位 wrapper | Radix/Popper | 负责碰撞和定位；不覆盖它的 transform |
| 桌面浮层内层：进入/退出 | Admin CSS | 专用 action menu 规则覆盖通用规则，不等于两个动画必然同时播放；以计算样式核实 |
| 手机操作面板外壳 | Vaul | 负责外壳出现与手势；内部层级不改变外壳拖动坐标 |
| 手机操作面板内层：x/opacity/layout | Motion | 仅当前层切换；避免外壳和内层各自执行相同方向滑入 |
| Dialog 遮罩与内容视觉层 | Admin CSS | Radix 管理 mount/unmount、焦点捕获与恢复；关闭不依赖业务定时器 |
| Accordion 内容尺寸 | 现有 Accordion CSS keyframes | Radix 控制开闭，FormSafety 控制表单；不再对同一节点加 Motion height |
| 表单错误展开 | 现有 CSS grid/opacity/transform | FormSafety 提供错误和定位；不重挂整份表单 |
| 普通表格行/移动卡片坐标与进出 | Motion | CSS 只做背景/轮廓反馈，不再改同一行 transform |
| 可拖动行/移动卡片坐标 | DndKit | Motion 仅控制透明度；禁止重新加 layout/scale/translate，保留既有修复 |
| 表格刷新进度条内层 | Admin CSS | Query 控制 busy 状态，不控制条的逐帧位移 |
| 批量悬浮栏视觉层 | Motion | CSS 负责 fixed、边界和安全区；不能随页面列表进场移动 |
| Dashboard 数字文本 | JS animate 数值驱动器 | 不再通过 CSS transform 模拟数字变化；保留取消、旧值和读屏最终值 |
| Dashboard 图表 SVG 几何 | Recharts | 外部内容容器可淡入，不能再次插值同一 path/clip 几何 |
| Dashboard 分类内容与尺寸 | 现有 DashboardFadeThrough / Motion | CSS 负责叠放布局，不再给同一面板加 keyframe 位移；不匹配节点与用户的实体 ID |
| 排行行位置 | Motion | 同类型稳定 ID 排序；不同类型走分类内容切换 |
| 排行流量条内层 | Dashboard CSS | 只控制条宽/揭示；不控制排行行坐标 |
| Button 根节点按压/状态层 | Admin CSS | 子图标的 Loading/Success 自有 CSS，异步结果由请求决定；不再给根节点加 whileTap 缩放 |

## 6. 保留、调整、移除清单

### 保留，不重复建设

- Theme Tokens、MotionProvider、减少动态效果的 CSS 与 JS 共同保障。
- 当前 Header、Sidebar、PageHeader、StatusChip、Dashboard 布局及移动详情。
- ProTable 保留旧值、局部进度、移动卡片、平板策略、保存视图、批量悬浮栏和滚动恢复。
- AdminActionMenu 的桌面/手机分工、碰撞定位、键盘、返回与焦点逻辑。
- 统一 Dialog 和手机全屏工作区；不恢复上游大型 Sheet。
- FormSafety 的未保存提醒、错误摘要、修改审阅、失败保留输入和敏感内容不落盘。
- DndKit 独占拖动 transform，稳定 action renderer，工作区稳定页面 key。

### 后续调整，先按风险排序

1. 桌面菜单可见性：AdminActionMenu 子菜单需要独立的 Portal/挂载边界；保留 Radix 定位与碰撞、层级键盘操作，不以全局取消 overflow 的方式影响 Header 等普通菜单。此项为浏览器确认的问题，不是动画曲线问题。
2. 数据反馈语义：区分刷新、查询变化与真实创建/编辑，避免假新增高亮；快速连续请求继续尊重现有最终响应逻辑。
3. 时序来源：CSS Tokens 与 JS transition 建立明确对应，保留不同语义的进入/退出差别，不把所有动画压成同一时长。
4. Dashboard 连续性：同次分类切换的摘要/列表保持统一时间关系；不重播全站总流量等无关区域；Tooltip 不因邮箱补齐重播整块内容。
5. 导航与 Tabs：初次 Sidebar 指示器测量、不同宽度标签、内容切换与焦点一致性；不能重挂输入表单换取动画。
6. 保存与弹层：统一业务完成和短成功反馈的关系；审查成功 timer 的卸载/减少动态效果行为。
7. 性能：核对数字逐帧 React 更新、长期 `will-change`、大列表布局动画；先测量再优化，不凭静态属性宣称手机掉帧。
8. 字号与层级：标题/分区/标签/说明沿现有体系整理，避免卡片嵌套和多主操作；不借动效精修改业务结构。

### 后续移除或限制

- 重复的局部硬编码时序：统一语义后再删，不能在第一步机械替换。
- 查询切换产生的假“新增”反馈；与实际数据无关的刷新入场。
- 同一 DOM 几何属性的双控制；不能把 Radix 定位 transform 当成冗余删除。
- 经性能验证无必要的长期 `will-change`；当前存在不等于已证实性能故障。
- 与当前数据无关的重复 Tooltip/容器重播。不同类型排行不应通过共享实体 key 强行插值。

## 7. 浏览器基线与复现

新增脚本只记录基线，不改测试数据或业务代码。要求匹配固定 SHA、`main` 和干净运行时路径；输出目录已有 `manifest.json` 时拒绝覆盖。

矩阵为 390×844、1024×768、1440×900，分别运行英文/浅色/普通动画和中文/深色/减少动态效果，共 6 组。小屏启用触摸模拟。这是代表性基线，并非语言、主题、动效的全排列，也不是实体触屏验收。

每组记录 9 个终态：Dashboard、用户列表、用户一级菜单、日志子菜单、服务器节点继承配置、服务器协议表单、VLESS 展开、商品基本资料、商品价格，共 54 张截图。每张附有 URL、motion 模式及关键节点计算样式；固定浏览器时钟避免日期与相对时间干扰。

脚本仅允许本机 HTTP 预览和 Mock 来源，拦截 `/v1/` 非 GET 请求并失败。只打开/关闭界面、切换菜单/Tabs/Accordion，不保存、创建、删除或调用真实后端。用户菜单实际为两级，不虚构三级业务菜单来凑基线。

```powershell
# 先完成当前 Admin production build。
# 终端一，工作目录 apps/admin：
node ../../node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 43002 --strictPort
# 终端二，仓库根目录：
$env:MOCK_API_PORT = '43124'
node apps/admin/tests/mock-api.mjs
# 终端三，仓库根目录：指定当前机器可用的 Playwright，输出到新的目录。
$env:PLAYWRIGHT_MODULE = '<installed-playwright-path>'
$env:PLAYWRIGHT_BROWSER_CHANNEL = 'msedge'
$env:ACCEPTANCE_ARTIFACT_DIR = '<new-local-evidence-directory>'
node scripts/capture-admin-motion-baseline.mjs
```

每次运行的准确浏览器版本、固定时间、状态、截图文件名与计算样式在输出 `manifest.json` 中。截图等待终态，不禁用普通模式动画；这仍不证明中间帧平滑、无瞬态闪烁或低性能手机达到特定帧率。

后续实际改动须补充中间帧/视频、快速反复切换、真实键盘/触摸、焦点恢复、刷新/错误/空数据、返回滚动位置与中低端设备测量；不能拿本阶段终态截图替代完整验收。

## 8. 第一阶段验收

- 五类页面、十类操作及各几何层唯一负责人已列明。
- 已有能力与后续调整分开；未改 API、Schema、Store、权限、路由、User Web 或实际 UI 动画。
- 第一阶段“基线与职责”完成；不代表现有 UI 或后续动效改动已完整验收。

### 本次执行结果

| 项目 | 结果 |
| --- | --- |
| Admin production build | 通过；现有 eval 与大 chunk 警告仍在，本阶段不顺带调整构建 |
| Admin TypeScript `tsc --noEmit` | 通过 |
| 新增捕获脚本 Biome / Node 语法检查 | 通过 |
| 浏览器基线捕获 | 最终 r3 运行 6 组完成，54 张终态截图，0 个 pageerror，0 个业务写请求 |
| 动效模式 | 27 份记录为 full，27 份为 reduced；只证明模式接入与终态，不证明全部 JS 动画逐帧符合策略 |
| 桌面日志子菜单 | 确认存在裁切问题；列为后续 P1，不计为功能验收通过 |
| 真实后端、实体手机性能、完整交互矩阵 | 本阶段未执行 |

最终本地证据目录名为 `motion-phase1-025a106-r3`，其中 `manifest.json` 记录 Edge 版本、固定时间、54 份样式和菜单状态。前两次目录保留，因终态捕获等待不足不作为最终菜单图像基线。捕获脚本的 PASS 仅代表记录完成及无 JS 错误/业务写入，不表示截图中的原有界面没有缺陷。

### 浏览器确认与静态推断分开记录

- **确认：桌面子菜单被裁切。** `desktop-submenu-diagnostic.json` 的 1440px 探针记录：子菜单 rect 为 x=1025、y=395、width≈178.6、height=158，opacity=1；其父菜单 x=1201 且 `overflow-x:hidden; overflow-y:auto`，子菜单中心命中检测为 false。源码中 `DropdownMenuSubContent` 没有独立 Portal，而根 `DropdownMenuContent` 开启横向裁切，与截图一致。`isVisible()` 不检测祖先裁切，因此不能单独作为功能断言。
- **确认：手机菜单终态可进入日志子级。** 最终捕获等待退出层移除、进入层可见，并等待实际渲染帧；截图显示返回按钮及四项日志。仅等待固定时间或短暂出现过节点不足以保证截图可靠，前两轮证据不覆盖删除。
- **确认：Admin CSS 实际覆盖通用浮层入场。** 普通模式计算样式中页面为 `admin-page-enter / 0.2s`、操作菜单为 `admin-action-menu-enter / 0.16s`、工作区为 `admin-dialog-enter / 0.3s`；不能仅因源码同时存在 Tailwind 类就认定双动画在播放。
- **确认：Tabs 不应一概而论。** 普通模式商品初始基本页计算样式 duration=0s，切换价格页为 0.2s；后续按实际组件状态统一，不机械替换所有 Tabs。
- **静态发现，待交互专项验证：** 查询结果差异被当作新增、Tooltip 邮箱补齐的 key 重播、Sidebar 首次测量和长期 `will-change`，均已列入后续清单；未宣称本阶段已测得具体闪烁或帧率问题。

最终 diff 与工作区检查：只新增上述文档和捕获脚本；运行时路径无改动，仍位于原 `main` 提交，未提交或推送。
