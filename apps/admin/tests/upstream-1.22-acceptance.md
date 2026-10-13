# 上游 1.22 兼容合并：第 7、8 步验收记录

日期：2026-10-13。结论：本地代码、构建及 Mock 浏览器验收通过；真实后端联调未执行，不能据此宣称生产业务已验证。

## 合并基线与范围审计

- 当前分支：`main`，未创建新分支。
- 本地基线：`06befd9b39b7b31d1007f5ef0d2a1931aa5b11ef`。
- 固定合并目标：`6e39d1a9349c3917c546cd3acbd1ef2684516a4f`，没有重新拉取或生成未来版本客户端。
- 与共同祖先相比，上游修改 42 个文件，按下表全部核对；额外本地适配和测试也已检查。
- 本报告记录提交前检查。用户已授权在 `main` 创建保留两个父节点的合并提交，并以普通推送更新 `origin/main`；最终结果以 Git 日志和远程 SHA 核对为准。没有修改后端。

| 上游文件组 | 数量 | 本地处理 |
| --- | ---: | --- |
| 五份 Swagger、三个聚合客户端及类型、OpenAPI 配置 | 12 | 逐文件 Git 内容哈希与固定上游提交一致；生成器未运行 |
| 13 个旧日志页面 | 13 | 使用本地 LogPage / MessageLogPage 集中接入日期范围，不恢复上游逐页 ProTable |
| 系统版本卡片及测试 | 2 | 只迁移重启 POST，保留卡片结构和确认、失败重试、焦点恢复 |
| 订单列表 | 1 | 本地已经初始化 URL search，确认保留；无须覆盖现有卡片和菜单 |
| 服务器协议 defaults、schema、schema 测试、字段配置 | 4 | 保留现有安全配置布局，统一指纹字段，允许已保存的历史值 |
| User 发码、密码、当前凭据、绑定表单 | 4 | 接入凭据验证规则；补齐无密码、手机账户、失败重试及本地会话清理 |
| Admin 日志与 User Profile 中英文 Locale | 4 | 保留本地完整语言包，合入新增键并验证对称性 |
| Changelog、根 package.json | 2 | 采用 1.22.0，保留本地 Husky 和构建配置 |

## UI 和行为保护

以下文件组与本地 HEAD 的 Git 标准化内容相同：Admin Theme Tokens、MotionProvider、main、Header、Sidebar、布局容器、Dashboard statistics 和 CSS、WorkspaceDialog、共享 Dialog、Admin Store、登录及权限路由、User 样式、Functions、开发代理、Husky、工作流和 lockfile。

导航只增加两个日志入口，不恢复旧侧边栏。ProTable 保留专用移动卡片、排序/数据连续性、批量悬浮栏；新增可选范围校验、重置过滤器和数据就绪回调。URL 恢复时禁止旧表格状态覆盖新历史条目。所有旧页面仍使用现有请求、状态、菜单和弹层规格。

新增边界测试：`upstream-1.22-boundaries.test.ts`。现有 UI、权限、表格导航、移动菜单和插件删除合同测试仍通过。

### 健康、设备 WebSocket 和 entitlement_source

- 保留 Common 的 `getHealthz` / `getReadyz`，不接入 Dashboard，也不改变当前健康指标。
- 开发代理只匹配配置前缀下 `/v1`、`/v2`；Pages Function 当前位于 `/v1`。根路径 `/healthz`、`/readyz` 不会因此自动转发。现有登录、订单和 Dashboard 使用 `/v1`，无需扩大代理范围。
- 健康接口不是现有 `code/data` 业务响应格式，现有 request 拦截器会拒绝缺少成功 code 的响应。将来真正接入探测时，应另外设计原始 HTTP 响应处理及精确代理路由，而非改变全部业务请求的判定规则。
- `getV1AppWsUseridIdentifier` 是生成的普通 GET 描述，未作为 WebSocket 使用。实际连接、升级、鉴权、心跳和重连未实现，也未测试。
- `entitlement_source` 仅保留在 Admin/User 类型，两个应用的运行时代码没有引用；未增加含义不明确的展示。

## 自动检查结果

共 320 项自动测试通过，另有 36 组真实浏览器的 Mock 检查通过。

| 检查 | 结果 |
| --- | --- |
| Admin Vitest | 42 个文件、194 项通过；最终使用 `--maxWorkers=2` |
| User Vitest | 17 个文件、81 项通过 |
| UI Vitest | 7 个文件、35 项通过，含 21 项 API 调用合同 |
| Functions / 开发代理 Bun 测试 | 8 项通过；空前缀、`/api`、特殊字符前缀、v1/v2、登录 POST、订单 GET、转发头与 OAuth 302 |
| Swagger / OpenAPI 来源合同 | 2 项通过；检查全部 6 份 Swagger，包括未改动的 edge.json |
| TypeScript | Admin、User `tsc --noEmit` 通过，包含共享组件及聚合类型 |
| UI 单独类型检查 | Vite/Bundler 解析模式通过，见下方命令说明 |
| Biome | 493 个源文件及验收测试/脚本通过 |
| Locale | Admin 全 Namespace、User 全 Namespace 中英文键对称通过，统一复数键后比较 |
| 生产构建 | Admin、User、Docs 均通过 |
| Git | 暂存及工作树 `git diff --check` 通过；无未解决冲突 |

高风险用例覆盖：重启 POST 与失败重试；首次绑定、更换绑定、密码/验证码证明、仅手机/无密码账户；注册发码 Token、按用途倒计时；OAuth nonce 成对存取和清理；退出失败仍本地清理及过期请求不恢复旧会话；钱包仅提交修改字段和明确的零值；Reality 指纹和历史指纹保存；日期默认今天、单边范围、旧链接转换、反向范围阻止请求、分页/滚动返回；两类新增日志、订单跳转、记录币种和无退款操作。

### 验证过程中的环境问题

- Biome 最初报 140 个 CRLF 格式差异，格式化后没有引入其他 Git 内容修改。本轮另修复 User 英文 Profile 里四个直接显示语言键的按钮文案，未改样式。
- 高并发浏览器与完整单测同时执行时，5 个 Admin 用例超过默认 5 秒时限。停止浏览器任务、限制为 2 个 worker 后，完整 194 项通过；没有提高用例超时或削弱断言。
- 沙箱内代理测试连接本地服务失败；同一网络环境中重跑 8 项全部通过。Docs 首次构建创建 Vue 链接受限，获准运行后构建通过。
- UI 独立 tsconfig.lint 的 NodeNext 解析不匹配现有 Vite 源码，会报导出映射/扩展名以及历史测试索引检查错误。没有借此修改所有公共文件；额外验证使用：`tsc --noEmit -p tsconfig.lint.json --rootDir . --moduleResolution bundler --module esnext --noUncheckedIndexedAccess false`。Admin/User 自身类型检查未降低配置。
- 非失败告警仍存在：jsdom 无法解析部分现代 CSS；构建中的既有自定义脚本 eval、大 chunk；Docs 的 caddy 高亮和 iconfont 运行时解析提示。

## 浏览器验收（Mock，不是真实后端）

使用生产构建预览、Headless Edge 和本地固定 Mock。两个脚本只允许 localhost/loopback 目标；所有 `/v1` 流量拦截后送本地 Mock，不操作真实账户。主题通过项目实际使用的 Cookie 初始化，并断言 HTML 的 dark 状态，而非只设置 localStorage。

- Admin：6 个宽度 × 中英文 × 浅深色 = 24 组，普通/减少动效按组合分配，每个宽度覆盖两种。覆盖新日志列表、Dashboard 渲染、无整页横向溢出、手机筛选工作区、日期倒置阻止请求、纠正后页码归一、空/错/无权限/加载状态、订单跳转返回、滚动 600px 恢复、用户手动滚动优先，以及键盘详情打开/关闭和焦点恢复。
- User：6 个宽度 × 英文深色/中文浅色 = 12 组。覆盖更换邮箱 Dialog、当前密码切换为验证码、失败保留输入并可重试、Tab 不逃出弹层、Esc 关闭恢复焦点、手机触摸重新打开并提交，以及成功后的本地退出。无密码/仅手机、注册 Token 和 OAuth 流程由组件及合同测试覆盖，未把它们宣称为浏览器端到端全流程。
- 宽度：390、430、768、1024、1280、1440；浏览器 viewport 高度 900，手机宽度启用 mobile / touch。
- 84 张截图保存在本地 `C:/Users/pjy23/.codex/visualizations/2026/08/21/01a0223c-56b8-7af3-ae3a-cbe67f579ef7/upstream-1.22-acceptance`。抽查手机深色详情、Dashboard、平板列表、桌面日志和 User 验证 Dialog；全部组合有布局断言。此轮不是全站每个页面的逐像素视觉回归，也不是实体手机性能测试。
- 可重复执行脚本：`scripts/check-log-browser.mjs`、`scripts/check-credential-browser.mjs`；需通过环境变量提供 Playwright 模块、浏览器 channel、本地预览/Mock 地址和可选截图目录。

## 真实后端待验证清单

### 后端版本要求（最终审查补充）

前端版本是 `1.22.0`，不等于后端要求同号版本。已只读核对官方固定 Swagger：

| 关键合同 | 后端 v1.20.3（d0e31dd0） | 已核实兼容基线 944dc363 |
| --- | --- | --- |
| 日志 start_date / end_date | 已包含 | 已包含 |
| /v1/admin/tool/restart | GET，和本次前端 POST 不兼容 | POST |
| 管理员操作、未匹配支付日志 | 缺失 | 已包含 |
| 发邮件/SMS 的 cf_token | 缺失 | 已包含 |
| 改密码 old_password / current_code | 缺失 | 已包含 |
| 更换邮箱 code / password / current_code | 缺少新增字段 | 已包含 |
| 更换手机 password / current_code | 缺失 | 已包含 |

因此，不能推荐 `v1.20.3` 作为本次全部功能的兼容版本。当前已核实满足这些合同的后端源码基线为 `944dc363cc6a28f6e294e739c9de9df1317ca00e`，也可使用明确包含相同合同的后续版本。未证明每个更早提交的兼容性，不能将这个基线称为精确的历史最低版本；也未证明任意更晚版本都没有破坏性变化。

来源：[后端 v1.20.3 发布](https://github.com/perfect-panel/backend/releases/tag/v1.20.3)、[v1.20.3 固定 Swagger](https://github.com/perfect-panel/backend/blob/v1.20.3/ppanel.json)、[944dc363 固定 Swagger](https://github.com/perfect-panel/backend/blob/944dc363cc6a28f6e294e739c9de9df1317ca00e/ppanel.json)。发布日期与前端 Swagger 同步时间不是接口兼容性的替代证据。

不要只因前端已推送就认为现有后端已经兼容，也不要直接以移动标签或未验证 nightly 替换生产后端。后端升级、数据库迁移、备份及部署需要单独安排；本次没有执行这些操作。

### 最终提交审查

- 最终合并差异为 117 个文件：固定 Swagger/聚合类型/版本；Admin 指纹与业务校验、钱包增量、收件人数、工单；统一日志日期范围及两个新日志的页面/导航/路由/语言包；User 凭据、验证码、OAuth nonce、退出流程；共享表格可选能力；测试、Mock、浏览器脚本和本验收记录。
- 主题、Dashboard 主体、侧边栏、主布局、统一弹层、用户端样式、Functions、代理、Husky、工作流与锁文件无内容回退；导航只有必要的新日志入口。
- 无冲突标记、未解决 Git 冲突、无关文件或临时旧服务兼容层。旧日期链接和保存过的指纹值兼容属于永久需求，不是待清理的临时代码。`settings-workspace` 是本地现有统一 Dialog 适配器，不是恢复上游侧边 Sheet。
- 最终提交前再次执行：Admin 194 / User 81 / UI 35 / Functions 8 / 合同 2 全部通过；Admin/User TypeScript、493 文件 Biome、diff-check 通过。Admin/User/Docs 构建重新通过；36 组浏览器结果来自紧接此前的第 7、8 步，同一运行时代码内容，没有将本次重复扫描算作新增浏览器验收。
- Windows/Turbo 根目录钩子的已知执行问题采用本次单次 `HUSKY=0` 规避；相关测试与 Biome 已按包手动运行，不永久关闭检查，也不修改 Husky 或 CI 配置。
- 保留两个父节点的合并，不 squash、不 force-push；推送目标仅为 `pjy02/frontend` 的 `main`，不向 `perfect-panel/frontend` 写入。

没有可用的、明确授权的真实测试账户/后端联调证据。以下必须在测试环境另行验证：

1. POST 重启是否真正完成、会话是否按规则失效和重新登录。
2. 邮件/SMS 是否到达、真实 Turnstile Token 是否被接受及消耗、无密码/手机账户验证是否通过。
3. 各真实 OAuth Provider 的 nonce、回调、邀请码和绑定保留情况。
4. 钱包并发变化时后端是否只更新提交字段，实际业务金额/币种单位是否与合同一致。
5. 指纹在后端存储与节点下发中的保留，以及历史值能否被实际节点支持。
6. 跨日期日志完整性、服务器时区边界、两个新日志的真实字段和权限，以及关联订单是否匹配。
7. 部署环境的代理/CORS、健康原始响应、WebSocket 升级与心跳；目前未启用这些新页面能力。
8. 实体中低性能手机、真实触摸输入法和真实后端慢网条件下的体验。

以上待办不是已验证通过的项目，不应在发布说明中写成真实后端联调完成。
