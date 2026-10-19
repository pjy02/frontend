# Admin 交互与视觉契约

本文件是新一轮精修的第一步，补充现有 [Motion 系统](./motion-system.md)，不建立第二套 Store、状态机或组件库。保留当前 Theme Tokens、MotionProvider、布局、API、路由、权限和表单行为。以下规则是后续组件改造的验收依据，不表示所有现有业务已经完成迁移。

本轮起点：`main@2721546`，开始时工作区干净；不创建临时分支。本记录用于回溯，不代表未来 HEAD。

## 业务状态先于视觉状态

| 操作 | 状态 | 必须表达的含义 |
| --- | --- | --- |
| 读取 | 首次加载 | 尚未得到结果，稳定占位；不能显示业务零值或允许覆盖未知配置 |
| 读取 | 已就绪 / 空数据 | 成功响应才允许判断有数据或确实为空 |
| 读取 | 已有数据刷新 | 保留当前内容、位置、筛选和弹层，仅显示局部刷新反馈 |
| 读取 | 首次失败 / 旧数据 | 首次失败显示重试；刷新失败保留旧数据并标明来源时间，不伪装成刚刚更新 |
| 修改 | 编辑 / 校验 / 审阅 | 校验失败定位字段；普通修改一次保存，高风险配置按需审阅 |
| 修改 | 提交中 | 仅锁定相关操作，保持输入，阻止重复提交 |
| 修改 | 写入已确认 | 以请求的业务结果确认成功，不以动画结束或 Toast 为依据 |
| 修改 | 刷新同步 / 已同步 | 写入成功后只同步相关数据；同步失败标记“已保存，显示尚未同步”，不当作写入失败重新提交 |
| 修改 | 写入失败或结果未确认 | 不播放成功、不清空输入；按接口语义恢复入口。网络中断不证明服务端未写入，非幂等请求不得自动重试 |
| 导航 | 目标已选择 / 页面准备中 | 立即表达目标，但保留 Shell；不能对 Loading 和真实内容重复入场 |
| 导航 | 内容就绪 / 切换完成 | 只过渡目标内容区域；新导航取消旧导航的视觉任务，不排队播放历史目标 |
| 弹层 | 打开 / 就绪 / 操作中 | 触发点、焦点和内容有明确关联；业务等待与外壳动画分开 |
| 弹层 | 关闭 / 焦点恢复 | 关闭通常比打开快；焦点恢复不能依赖动画成功结束。触发点消失时使用合理的列表或页面后备焦点 |

### 不可混淆的信号

- `animationend`、`transitionend`、Motion 的完成回调只结束视觉阶段，不能调用业务成功逻辑。
- Toast 是结果提示，不是同步状态；写入与重新读取必须分别处理。
- 取消旧动画不取消已经写入的事实；取消请求也不保证服务端回滚。
- 乐观更新必须有明确回滚与请求身份校验；过期响应不能覆盖新操作。
- 未保存离开保护与保存审阅是两件事。密码、私钥、Token 不为草稿而写入 localStorage。
- 本步不修改佣金审核、排序、开关、配置读取等业务实现；这些现有缺口必须在后续对应阶段逐项验证，不能因为本契约存在就标记完成。

## 静态视觉职责

| 层级 | 入口 | 默认规格 |
| --- | --- | --- |
| 页面 | PageHeader / `--admin-type-page` | 24px，负责“我在哪里” |
| 工作区 | Dialog 标题 / `--admin-type-workspace` | 18px，负责当前任务 |
| 分区 | CardTitle、`.admin-section-title` | 16px / 600 |
| 子分区 | `.admin-subsection-title` | 14px / 600；保留 JSX 的 h2/h3 语义，不统一覆盖全部标题 |
| 字段 / 正文 | FormLabel、`.admin-field-label` / body Token | 14px；标签 500 |
| 辅助说明 | FormDescription、`.admin-helper-text` | 13px，次要文字色 |
| 元数据 | `.admin-meta-text` | 12px，不能承载唯一的关键操作说明 |

字体沿用现有西文体系，显式添加 Noto Sans SC、苹方、微软雅黑、冬青黑体等中文无衬线回退；不新增远程字体依赖，也不宣称所有系统会渲染相同字形。

颜色职责：

- `--admin-brand` 保留品牌蓝；`--chart-*` 保留图表标记色，不直接用作小字号文字。
- `--admin-action*` / `--admin-on-action` 用于实心操作；`--admin-link*` 用于链接；按钮正常、悬停、按下及状态层合成后均检查文字对比。
- `--admin-danger-action*` / `--admin-on-danger` 用于危险实心操作；状态文字与浅底使用 `--admin-success/warning/danger/info` 及对应 surface。
- `--admin-chart-text-*` 是图表文字的可读配对色；不是把图表图形整体改成更深的色块。
- 状态仍须有文字或图标，不以红绿或涨跌颜色代替含义。禁用、图形和文字的验收标准需分别判断。
- 一个区域突出一个主要操作。减少嵌套边框，优先用标题、留白、分隔线组织详情；不删除 fieldset、legend、错误锚点和焦点语义。
- 本步在用户认证资料、请求风险详情先落实扁平分区；其余复杂表单分批迁移，不用全局 CSS 强行抹除所有边框。

## 动效职责和唯一位移控制方

规则按“元素及属性”分配：不同层可以分别定位、动画，但同一元素的同一位移属性只能有一个控制方。

| 区域 / 属性 | 负责人 | 不能叠加的控制 |
| --- | --- | --- |
| 按钮颜色、状态层、按压 | Admin CSS + 现有 Button 状态属性 | 页面另加 scale、用成功动画控制请求结果 |
| 菜单外层定位 | Radix 浮层定位器 | 覆盖其定位 transform |
| 菜单内容进出、层级切换 | 现有菜单内容层 CSS / 手机面板层级控制器 | 同一内容层再加第二套 Motion 入场 |
| Drawer 手势位移 | Vaul | 另一套 translate / layout 动画争夺手势；时长桥接在后续阶段完成 |
| Dialog 外壳、遮罩进出 | Admin CSS / Radix Presence | 页面为同一外壳重复位移；关闭时丢失焦点恢复 |
| 内容导航过渡 | 现有页面切换控制器 | Shell、Sidebar 和每张卡片重复入场 |
| 数据反馈 | ProTable 现有结果层与记录身份机制 | 普通查询换页被当作业务新增；刷新强制重新挂载整表 |
| 拖动行排序 | DnD | 同一行同时启用 Motion layout transform |
| 排行、数字、图表 | 现有 Dashboard Motion / 数值控制器 / Recharts 各自对应层 | 从零重播普通刷新、旧目标排队、邮箱更新触发行入场 |
| 主题根快照扩散 | 现有 Theme Reveal / 原生 View Transition | 全站同时逐元素过渡颜色；保留原生不支持与减少动态效果回退 |

对应维护入口（相对仓库根目录）：

- 视觉与 CSS 动效：`apps/admin/src/styles/admin-theme.css`；参数与启用：`apps/admin/src/components/motion-tokens.ts`、`motion-provider.tsx`。
- 内容导航：`apps/admin/src/components/page-transition.tsx`；冷加载边界：同目录 `route-content.tsx`。
- 菜单与工作区：`apps/admin/src/components/admin-action-menu.tsx`、`workspace-dialog.tsx`；Radix/Vaul 定位与手势继续由共享 Primitive 负责。
- 表格反馈与拖动：`packages/ui/src/composed/pro-table/data-continuity.ts`、`pro-table.tsx`、`sortable-row.tsx`、`sortable-mobile-card.tsx`。共享实现仍需 Admin 显式启用，不改变 User Web 默认行为。
- Dashboard：`apps/admin/src/sections/dashboard/components/dashboard-motion.tsx`、`statistics.tsx`，CSS 位于该分区的 `dashboard.css`。
- 主题扩散：`apps/admin/src/components/theme-transition.ts`、`theme-transition-provider.tsx`。

参数继续只来自 `motion-tokens.ts`，由 MotionProvider 同步 CSS 与 JavaScript。不在业务页面重新填入同义时长。按压短而直接；状态主要用颜色、透明度；位置、尺寸、展开只解释空间关系；退出一般短于进入。动画不延长业务锁定时间，新目标可中断旧动画，从当前显示状态继续。

减少动态效果使用现有 Profile：取消位移、缩放、延迟和排名移动，保留即时状态、必要文本和焦点反馈。CSS、Motion、手势、原生 View Transition 都要分别验证，不能仅凭一个媒体查询判断全部通过。

## 第一阶段验收与后续边界

第一阶段验证颜色配对、字体层级、两处扁平分区、既有 Motion 参数关系与减少动态效果解析；浏览器验证真实控件的 CSS 合成，不能只计算 Token。

后续阶段再完成业务成功与回滚、配置加载保护、键盘结构、表单安全、Drawer/Accordion 参数桥接、导航就绪、工单跟随、Dashboard 口径和性能优化。不得把这些待办写成第一阶段已经修复。

## 第二阶段：已落地的操作反馈策略

- `AsyncSwitch` 使用已有 TanStack MutationCache，在当前账号、资源、记录范围共享锁定，包括同时挂载的桌面、手机副本和同记录的不同开关。不增加持久化状态；不缓存凭据。采用等待确认的受控更新，没有需要回滚的乐观业务值。
- 写入失败保留原值与输入；写入确认后读取失败用 `SavedSyncError` 保留已保存值，只开放读取重试。`ProTable.refresh({ throwOnError: true })` 是显式的读取结果通道，未启用该选项的既有调用不改变行为。
- 手机卡片的窄操作区显示简短错误提示，可通过点击或键盘打开完整说明；“重试刷新”仍直接可用，触摸高度至少 44px，不用完整错误段落挤压标题。
- 佣金审核共享记录锁，失败会继续报告给 ConfirmButton，驳回失败保留理由；审核已写入而列表刷新失败时不再显示审核入口，只允许重试刷新。
- Admin 排序向业务回调传入快照，两个结果视图共享排序锁；失败保留原始顺序，期间出现的新查询结果不会被迟到的排序覆盖。服务器保存等待真实请求，重复排序号会规范化为有效位置。
- Button 在 Admin 启用稳定内容层与状态层，立即锁定 Loading；图形延后 120ms 显示。完成不等待图形转完一圈，成功刷新提示不阻止下一次点击。减少动态效果取消展示延迟和缩放。
- Admin ConfirmButton 默认不再叠加成功打勾与业务 Toast，也不等待固定 420ms。只需一个就近确认图形的调用可显式选择 `successFeedback="brief"`，使用 180ms 的 `successHold`，此时调用方不应再弹成功 Toast。User Web 未启用 Profile 时维持原默认行为。
- 普通表单的失败就近显示输入保留说明，不额外叠加第二条失败 Toast；已接入的 CRUD 表单对显式 false 结果按失败处理，成功沿用 `completeSave`，不清空仍可见的输入。
- 本步不宣称所有配置加载、复杂表单安全、所有批量操作的部分成功和实体手机性能已经统一；这些仍需对应后续阶段验证。接口没有幂等保证时，网络中断只能标记“未确认”，不能虚构服务端回滚。

自动验收入口：`async-switch.test.tsx`、`button-feedback.test.tsx`、`table-write-feedback.test.tsx`、服务器 `sort-servers.test.ts`、佣金 `withdrawal-actions.test.tsx`，以及 `scripts/check-admin-operation-feedback.mjs`。浏览器脚本只转发本机 GET 夹具，所有写入都在浏览器中拦截模拟；这不等于真实后端联调。

## 第三、四阶段：读取与导航交接

- `ReadBoundary` 区分首次加载、首次错误、正常内容、后台刷新、旧数据和空记录；首次没有数据不挂载可编辑默认值，保存入口同时禁用并在提交函数中复核。显式空配置可以初始化；缺失响应体是读取错误，不能被当作空配置。
- 认证、系统和订阅配置、全局与服务器节点配置、动态倍率、安装命令、用户资料和系统日志使用相同规则。后台刷新不卸载已挂载内容；失败提示显示上次数据。动态倍率读取不会覆盖未保存输入，安装配置尚未读取时不允许复制缺少密钥的命令。
- 人数预估使用 `useLatestEstimate`：按条件去抖，条件更改、关闭工作区或重新尝试时废弃旧请求的结果与错误。失败保留未知值，不填充零；真实零仍显示零。重试按钮明确为 `type="button"`，不能触发发送或创建任务。
- 导航匹配优先具体和更深的路径，仪表盘不是所有后台页面的前缀兜底。缺失标题的列表使用现有 PageHeader，工具栏不再重复页面标题；创建与筛选入口保留原位置。
- 折叠侧栏使用 Radix 菜单与真实链接，支持 Enter、方向键、Esc 和焦点返回；展开组收起后立即 inert。选中背景首次测量、侧栏形态及尺寸变化直接定位，常规导航保留连续移动，ResizeObserver 不在每次导航重新创建。
- `AdminContentReady` 在当前 Suspense 内容提交后通知持久内容容器，导航动画与内容焦点不提前消耗在占位上。后续目标中断旧动画；历史返回和同一列表的嵌套路由工作区不重播整页入场。Header、Sidebar、Outlet 和列表身份不因动画重挂载。
- 本轮不改 API、Store、后端或 User Web 视觉；浏览器夹具验收与真实后端联调、实体设备测试分别记录。
