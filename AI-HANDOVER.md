# Koyome.me — 项目交接文档（AI Handover）

> 写给下一个接管本项目的 AI（或人类开发者）：**读完这一份，即拥有继续开发的全部上下文。**
> 最后更新：2026-09-21（第十二轮：旅行照片层叠切换 / 自建地标跳传照片 / 地标图标 + 地图仪表 / 爱好Q版槽防遮挡 / 电台封面去中圆）
> 仓库 HEAD：`49cbef4`（线上已同步）｜ 用户已授予 AI **随时推送的常驻权限**（§4.3）

---

## 0.10 第十二轮速览（2026-09-21）

- **旅行照片层叠（i1，entry.js `renderDeck()`）**：i1 的图片媒体改为一摞拍立得（`.deck`）——顶图完整展示，后 3 张微露边（左右交替扇出），再深处隐藏。点击照片叠（或 Enter/Space）：顶图向右下滑出（`.deck-exit` 0.26s）→ 静默沉底（`.deck-settle` 断一帧过渡）→ 其余平滑递进（0.55s cubic-bezier），无限循环。计数 `NN / 08`；**共享描绘条始终描述顶图**（站长双击编辑的就是顶图 caption）。reduced-motion 全程瞬时。站长删除按钮只在顶图显示。
- **自建地标跳传修复**：`mapPins` 图钉若名字（zh 或 en，≥2 字符）出现在某张照片描绘里 → 自动成为可点击跳传（`tm-linked` + `data-mi`），点击=滚动到照片叠并**将该照片置顶**（`i1DeckCtl.toTop`）；无匹配则保持只读。站长删除改由图钉旁的小 ✕（`.tm-upin-x`）触发——点图钉本身不再误删。
- **地标图标**（`SPOT_ICONS`，24 网格线稿）：东京塔（桁架塔）、东大（山墙柱廊）、你的名字（鸟居）、新宿（楼群）、涩谷（框内 X 道口）；自建图钉=通用水滴针。图钉改版为**徽章式**：细杆 + 圆形徽章（内置图标）+  exact 点红芯，标签置徽章右侧（近顶/近右自动翻转）。
- **地图仪表**：两图新增指北针（红箭头+N）与比例尺（东京 5 KM / 济州 10 KM）；水域/绿地接入新变量 `--map-water/--map-park`（日夜双色，带一点青灰/苔绿）。
- **爱好Q版槽防遮挡**（hobbies.js `DECO_POS` 三档）：≥1400px 六槽全部锚定内容列两侧**页边空白**（`calc(50% ± 566px)`，固定不滚且零遮挡）；721–1399px 缩为 2 个 64px 角落槽；≤720px 只留 1 个 46px 小槽在页头下方。槽本就 position:fixed（R9），用户感知的"跟随滚动"是缓存旧版；本轮真问题是遮挡，已按档位消除。
- **电台封面**：`.track-cover::after` 中圆（盖住封面中央 32%）已删；圆形黑胶裁切与均衡器刻度保留。
- **测试沙箱事故**：jsdom 回归的 guestbook 测试把 `StaticTester` 写进了**真实云表**（id=9；anon key 无 DELETE 权限，**需用户在 Supabase 仪表盘 Table Editor 手动删除该行**）。已在 test-static.js 内置静态服务器拦截 `/js/gb-config.js` 返回空配置——测试永远走本地回退链，24 项全绿，云表不再受测试污染。
- **新工具**：`tools/probe-deck.js`（照片叠+图钉跳传 CDP 实测）、`tools/probe-hdeco.js`（装饰槽 fixed 实测）、`tools/check-sb-tester.js`（云表测试残留排查）、`tools/pages-build-admin.js`（Pages 构建状态查询 + 请求重建）。经验：**SVG `<g>` 无 `.click()`，探针须 dispatch MouseEvent**。
- **Pages 构建事故（首次遇到）**：R12 三次推送的代码瞬间到达远端（SSH 推送本身毫无问题），但 GitHub Pages 的**自动构建**连续三次 `errored: Page build failed`（15:42–15:45 UTC，GitHub 官方状态页无事故，仓库内容无异常——纯服务端抖动）。**解法等不用改代码**：`POST /repos/Koyome/koyome.github.io/pages/builds`（带 gh-token）手动请求一次重建即 `built` 成功，同一 commit。排查命令在 `tools/pages-build-admin.js`。教训：push 成功 ≠ 上线，线上轮询失败时先查构建状态再怀疑代码。

---



## 0.9 第十一轮速览（2026-09-21）

- **手机端首页**：deco.js 首页第一个漂浮图形（摆动圆）在手机端与星球重叠——移动端首页已过滤该图形（桌面端不受影响，`page==='home' && si===0` 才跳过）；`.hero-orbit` 移动端从 `right:-90px`（外环被裁）改为 `right:-10px; top:-14px; min(60vw,250px)`，整个星球雕塑完整入镜；`.hh-compass` 移动端 `right:2px` 不再出血。
- **罗盘质感升级**（index.html 内联 SVG）：新增渐变表盘（`hhFace` 径向）、北针红色渐变（`hhNorth`）、墨针渐变（`hhInk`）、30° 短刻度环、右上玻璃高光弧、中心帽高光点、扫秒针尖光晕；CSS 加 `drop-shadow`（日夜两色）。设计语言不变，变量驱动日夜自适应。
- **夜间六芒星整治**：sigil SVG 硬编码灰色全部接入新 CSS 变量 `--sigil-{dash,ring,chord,tri,node}`（日间值=原色，像素级不变；夜间调暗调匀），弦线组 `.sigil-chords` 夜间 opacity 降至 0.5——黑纸上的线条不再凌乱。
- **星空性能**（entry.js `renderStarfield()`）：手机端 DPR 封顶 1（原 ≤2，全屏重绘量减半以上）、重绘节流 ~30fps（dt 累加 `dtDraw`，流星步长用累计值，速度不变）、小方星改为单 alpha 批量填充（逐星 globalAlpha 切换是主要绘制开销），十字星保留闪烁。视觉几乎无差，滑动不再卡。
- **事故记录**：本轮中 `.git` 再次损坏（refs 目录与 objects/pack 丢失，`bad object HEAD`——与第九轮同因，非 AI 操作导致；一次 `git stash` 命令途中被 SIGTERM 可能加剧了暴露）。已按 §0.7 同法恢复：SSH 克隆 → 移植 `.git` → 工作区零改动（diff 仅本轮 4 个文件），另补回 repo 本地 `user.name/user.email`（Koyome/koyome@localhost，新克隆不带）。
- **新工具**：`tools/shot-r11.js`（Edge headless CDP 截图台：多规格 视口/主题/滚动 批量截图，复用性强）、`tools/check-sb.js`（Supabase 只读探针）、`tools/verify-r11-live.js`（线上轮询验收）。
- **测试备注**：jsdom 回归 22 项中 guestbook en/zh list 两项报 0 items——jsdom 内云表 fetch 不可达所致的环境性失败（Supabase 实测 HTTP 200 有数据），与本轮 diff 无关；其余全过。

---



## 0.8 第十轮速览（2026-09-21）

- **素材清理**：用户提供的两张设计图（罗盘星/放射之眼）及其全部引用已删除（`assets/deco/` 目录不存在了，勿再引用）；首页人像注释改为**可编辑组件**——文字存 `profile.json` 的 `figNote/figNoteZh`（空=隐藏），站长双击编辑，main.js `renderPortraitNote()`。
- **新图形（Stone Island 式：几何线条、简洁构图、品牌标识感）**：首页爱好区 **罗盘徽章 `.hh-compass`**（内联 SVG，四芒星+刻度+60s 扫秒针，接替被删素材）；旅行页首 **线条房屋立面图 `.i1-houses`**（entry.js `housesStrip()`）。与首页星球同一套细线/虚线/mono/红点语言，CSS 变量驱动日夜自适应。**星球图形用户确认满意，勿动。**
- **双地图（entry i1，`renderMaps()`）**：旧潦草街网+连线已废弃。**东京图**=数字化重绘（测量网格、东京湾、隅田川、山手线环+站点、绿地、印刷体地名；照片图钉仍由描绘关键词驱动，点击跳照片）；**济州岛图**=同标准新绘（汉拿山盾形岛、1132 环岛路、城山/山房山峰标）。**站长点击地图空白处可标注地名**（浮出命名卡 → `entry.mapPins.{tokyo,jeju}` → PUT /api/content；点自建图钉可删）；游客只读。**地标间不画连线（用户明确要求）。**
- **私人剪辑（v1）边框**：胶片齿孔已废弃，改为画廊展板=发丝细框+左上角一小段红角标+纸质标签牌。
- **server.js 新字段**：PUT /api/content 接受 `mapPins`（坐标钳制 0–560/0–400，每图 ≤60）；POST /api/profile 接受 `figNote/figNoteZh`。**本机服务需重启一次才生效**（§4.2）。
- 上一轮（人像抠图 `avatar_cutout.webp` + 星球细节化）本轮才随之一并推送上线。

---

## 0.7 第九轮速览（2026-09-21）

- **夜间模式**：`[data-theme="dark"]` CSS 变量翻转（style.css 顶部）；header.js 注入日/夜按钮 + 全站图纸角标 `.page-frame`；6 个 HTML 的 `<head>` 有防闪烁预置脚本；localStorage 键 `koyome_theme`。
- **首页**：hero 轨道雕塑 `.hero-orbit`（纯 CSS 自主运动）；画像区=照片钉在手绘地图（`.portrait-map` 线稿 + vignette + 倾斜回正）；爱好引导区**按日随机 4 张**（main.js `dailyShuffle`，日期做种子，当天固定）。
- **爱好页**：新增 `galgame` 分区（i18n `hob_sec_galgame*`；data.js normalize 保证三分区；server.js 裁剪 ≤4 分区原生兼容）；Q版装饰槽 **3→6 且改 `position:fixed`**——不再随内容下移（bug 根因=百分比绝对定位）；移动端只显示前 3 个。
- **素材边框按板块分方言**：`entry.js` 给 `.media-stack` 加 `media-<entryId>` 类——i1=图钉相片盘、v1=胶片链齿孔、t1=黑胶+均衡器刻度；爱好页按 `[data-sec]` 分框式。
- **旅行地图**：entry.js `renderTravelMap()`（仅 i1）——SVG 街道网+虚线行进路线+地标图标；节点由**照片描绘里的地名**驱动（TRAVEL_SPOTS 关键词匹配），点击滚动到对应照片。
- **星空**：entry.js `renderStarfield()`（仅 t2）——canvas 固定背景，十字/方形星+星座线+随机流星；颜色读 `--star/--star-line/--meteor` 变量（日夜自适应）；reduced-motion 只画静态帧。
- **性能**：大图全部生成 `assets/opt/` 衍生（**原图未动**，脚本 `tools/make-opt-images.py`）；profile.avatar 与 i1 的 9 处 src 已切换引用；视频/音频 `preload="none"`；图片 `decoding="async"`。
- **事故记录**：本轮中 `.git` 曾被外部力量送入回收站（非 AI 所为），已用 SSH 重新克隆移植恢复，零数据丢失。

---

## 0. 给用户的一段现成提示词（可直接贴给下一个 AI）

```
请阅读我项目根目录下的 AI-HANDOVER.md（路径 C:\Users\Public\koyome-site\AI-HANDOVER.md），
它是完整的项目交接文档，读完再开始改动。硬规则：不要删除或覆盖 docs/assets/ 里任何
已存在的素材文件，不要重置 docs/data/ 下的 json —— 那是我手动上传的真实内容。
改完想上线的话按文档 §4.3 用 SSH 推送（密钥在 tools/deploy-key）。
```

---

## 0.5 硬规则（红线——违反会破坏用户数据）

1. **绝不删除/覆盖 `docs/assets/` 里任何已存在文件** —— 全是用户手动上传的照片、视频、MP3。
2. **绝不重置 `docs/data/` 下的 `content.json`、`profile.json`、`hobbies.json`、`guestbook.json`** —— 全是用户真实内容，不是种子数据。
3. **所有路径保持相对路径**（`assets/...`、`data/...`，不带前导 `/`）——全站既有惯例，也防未来托管路径变动。
4. **任何文本字段都要维护双语**：`title/titleZh`、`body/bodyZh` 等。新增 UI 文案必须同时加进 `docs/js/i18n.js` 的 `en` 和 `zh` 两个字典。
5. 改完文件用搜索工具确认改动真的落盘（本环境出现过 Edit 静默失败，§4.5）。

---

## 1. 项目概览

### 1.1 目标
**Koyome.me** —— 用户的双语（English / 繁體中文）极简个人网站：收藏文字、图片、视频、音乐，展示动漫爱好，并接受访客留言。设计语言：浅纸色底、衬线标题、等宽小标签、红色 accent（`--accent: #9e2b25`），安静的极简纸质风（参考 1uvng.me，不照搬）。

### 1.2 整体架构

```
                        ┌────────────────────────────────────┐
   访客（任何设备） ──► │ GitHub Pages 静态托管 (只读快照)     │  https://koyome.github.io/
                        │  docs/ 目录 = 网站本体              │
                        └──────────────┬─────────────────────┘
                                       │ 留言读写 (fetch PostgREST)
                                       ▼
                        ┌────────────────────────────────────┐
                        │ Supabase 云数据库 (public.guestbook)│  全站共享留言
                        │ RLS: anon 仅 SELECT + INSERT        │
                        └────────────────────────────────────┘

   站长（用户电脑） ──►  server.js (端口 80, http://Koyome.me)
                        = 站长编辑台：读写 docs/data/*.json、上传素材到 docs/assets/
                        改完 → git commit → SSH push → Pages 自动重建上线
```

**双模式数据层**是理解全站的钥匙（`docs/js/data.js`）：运行时探测 `api/content` 是否存在——

| | 本机模式（server.js 运行中） | 静态模式（GitHub Pages） |
|---|---|---|
| 判定 | API 存活 → 站长（管理员） | API 不存在 → 游客（纯只读） |
| 内容数据 | Node API 读写磁盘 json | localStorage 覆盖层 → 内置 `data/*.json` |
| 管理页/编辑按钮 | 可见可用 | 完全隐藏（§2.3-3） |
| 上传素材 | 写入 `docs/assets/` | 无入口 |
| 留言 | **云表优先**（与线上一致） | **云表优先**；云未配置/失败时回退 localStorage |

**推论**：更新线上内容的唯一正确流程 = 本机改 → commit → push → Pages 重建。

### 1.3 技术栈
- 前端：纯 HTML/CSS/JS，无框架、无构建步骤、零 npm 依赖；双语 i18n 自制字典。
- 本地后端：`server.js` 单文件零依赖 Node（静态托管 + JSON API + 上传落盘），~470 行。
- 云后端：Supabase（PostgREST，纯 fetch，无 SDK；`sb_publishable_` anon key，RLS 只读+只写）。
- 托管：GitHub Pages（main 分支 `/docs`，`.nojekyll` 已就位）。
- 部署：SSH 原生推送（首选）/ REST Git Data API 重放（备选，§4.3）。
- 测试：jsdom 静态回归 + Edge headless CDP 端到端（Node 22 内置 WebSocket）。

### 1.4 当前进度
**功能全部完成并上线**（线上 = HEAD `a80506e`）：6 个页面、双语、游客只读、移动端适配、云端共享留言板全部生效；用户全部内容（10 首歌、9 个视频、8 图旅行、8 动漫 + 5 角色）均已推送，本地与线上同步。

---

## 2. 已完成工作

### 2.1 功能模块清单

| 模块 | 状态 | 说明 |
|---|---|---|
| 首页 index | ✅ 上线 | loader 动画、个人资料（头像/欢迎语/自述）、目录索引区、**爱好引导区**（拍立得卡片+引导链接）、六芒星 sigil |
| 目录页 catalog | ✅ 上线 | kinetic title：逐字模糊入场、悬停扫光+下划线、ghost 序号视差；站长双击标题内联改名 |
| 详情页 entry | ✅ 上线 | 图文/视频/音乐；12 列错落网格；素材描绘 caption 双击编辑；音频 track-card（ID3 封面自动读取）；NOTE/手記 区块；**i1 双地图（东京+济州岛，站长点击标注地标）**；t2 星空 |
| 爱好页 hobbies | ✅ 上线 | 两分区「喜歡的動漫/動漫角色」河流式交错布局；图文自由增删改；3 个 Q版装饰槽（已用 2） |
| 留言板 guestbook | ✅ 上线 | **Supabase 云端共享**；蜜罐反机器人；20 秒限流；云端时间按访客本地时区显示 |
| 管理页 admin | ✅ 上线 | 仅站长机可见（游客重定向）；条目增删改、profile 编辑、上传 |
| 双语系统 | ✅ 上线 | EN（默认）/繁中切换，localStorage 记忆；全部 UI 文案双字典 |
| 游客只读 | ✅ 上线 | 角色=API 探测；管理入口/编辑/上传/删除全部按角色条件渲染 |
| 移动端适配 | ✅ 上线 | sticky 页头修复菜单遮挡、全宽菜单面板、装饰元素移动版缩减渲染、iOS 防缩放、480px 断点 |
| 仓库改名 | ✅ 上线 | `Koyome/koyome` → `Koyome/koyome.github.io`，网址缩短为根路径 |

### 2.2 文件目录结构及作用

```
C:\Users\Public\koyome-site\          ← 项目根（= git 仓库根）
├─ server.js                          本地服务器 + 全部 API（零依赖；__dirname 寻址，无 cwd 依赖）
├─ start-koyome.bat                   双击启动本机网站（带窗口，端口 80）
├─ start-hidden.vbs                   ★ 双击后台静默启动（无窗口，独立于任何会话）
├─ setup-koyome-me.bat                一次性配置：hosts 映射 + 代理绕过（需管理员，已跑过）
├─ AI-HANDOVER.md                     本文档
├─ .gitignore                         含 tools/deploy-key*、gh-token.txt、*.log、server.pid
├─ docs/                              ★ 网站本体（GitHub Pages 发布的就是这个目录）
│  ├─ .nojekyll                       必须存在！否则 Pages 的 Jekyll 吞掉下划线文件
│  ├─ index.html                      首页（个人介绍 + 目录索引区 + 爱好引导区 + 六芒星）
│  ├─ catalog.html                    目录页
│  ├─ entry.html?id=xxx               条目详情页
│  ├─ hobbies.html                    爱好页
│  ├─ guestbook.html                  留言板（含蜜罐隐藏字段 #gbSite）
│  ├─ admin.html                      管理页（游客被 JS 重定向）
│  ├─ css/style.css                   全部样式（CSS 变量配色；~1000 行；含移动端 3 个断点）
│  ├─ js/
│  │  ├─ i18n.js                      双语字典 + 语言切换（所有 UI 文案在此，en/zh 双字典）
│  │  ├─ data.js                      ★ 数据层：模式探测、云→API→localStorage→内置 json 回退链
│  │  ├─ gb-config.js                 ★ Supabase 凭据（url + sb_publishable key，公开设计）
│  │  ├─ header.js                    公共头部（导航 + 语言切换；admin 链接仅站长机注入）
│  │  ├─ main.js                      首页逻辑（loader、profile、目录区、爱好引导区渲染）
│  │  ├─ catalog.js                   目录页逻辑（kinetic title、双击改名）
│  │  ├─ entry.js                     详情页逻辑（媒体渲染、上传、ID3 封面、caption 编辑）
│  │  ├─ hobbies.js                   爱好页逻辑（图文增删改、Q版装饰上传）
│  │  ├─ guestbook.js                 留言板逻辑（云优先发送链、蜜罐、限流）
│  │  ├─ deco.js                      全站漂浮几何装饰（移动端缩减、reduced-motion 关闭）
│  │  └─ admin.js                     管理页逻辑（顶部角色 gate）
│  ├─ data/
│  │  ├─ content.json                 ★ 全部条目（真实用户数据，勿重置）
│  │  ├─ profile.json                 ★ 首页个人信息（用户亲笔，勿重置）
│  │  ├─ hobbies.json                 ★ 爱好页数据（用户真实内容，勿重置）
│  │  └─ guestbook.json               本地留言种子（云模式下仅兜底用）
│  └─ assets/                         ★ 全部素材（用户上传的图/视频/MP3/封面，勿动）
└─ tools/                             开发辅助（不进网站）
   ├─ deploy-key / deploy-key.pub     ★ SSH 部署密钥（gitignore；公钥已登记 GitHub 账号）
   ├─ gh-token.txt                    REST 备用 token（gitignore，scope=repo）
   ├─ gh-device-auth.ps1              GitHub 设备授权脚本（带重试）
   ├─ push-via-api.js                 REST 推送：重放提交保 SHA、断点续传 push-state.json
   ├─ test-static.js                  jsdom 静态渲染回归（22 项）
   ├─ test-render.js / verify.js      渲染/验证脚本
   ├─ fix-git.js                      git 配置修复（历史遗留）
   └─ make-avatar.py                  形象图生成脚本
```

路径注意：`C:\Users\杨坤\WorkBuddy\2026-09-19-19-30-28\koyome\` 与 `C:\Users\Public\koyome-site\` 是同一目录（junction）。**统一用 `C:\Users\Public\koyome-site\`。**

### 2.3 重要技术决策及原因

1. **双模式数据层（API 探测）**——同一套代码既能在本机读写磁盘（站长编辑），又能在 GitHub Pages 静态环境只读运行（游客）。免去两套代码；角色判定零配置。
2. **留言板上 Supabase 而非自建**——Pages 无后端，访客留言原本只存各自 localStorage（互不共享，用户报障的根因）。选型排除：WorkBuddy Cloud Service（publishableKey 强制 Origin 匹配自家域名，跨域被拒）；自建服务器（家庭宽带无公网 IP）。Supabase 免费层 + RLS（anon 仅 SELECT/INSERT，天生无法改删）+ 纯 fetch 无 SDK，零成本零依赖。删除留言=站长去 Supabase 仪表盘 Table Editor。
3. **游客纯只读的条件渲染**——曾所有访客可见删除按钮/管理入口（安全事故级）。现所有编辑能力由 `apiAvailable()` 驱动渲染，游客 DOM 里零编辑痕迹；admin 页 JS gate 重定向。
4. **页面间过渡动画全部拆除**——做过两版（v1 被反馈"卡、不完整"；v2 修好后用户仍决定不要）。教训：用户审美判断优先于技术完成度。全站唯一动画=首页 loader，保持勿动。
5. **仓库改名 `koyome.github.io`**——免费把网址从 `/koyome/` 缩短到根路径；Pages 配置自动保留。代价：旧 `/koyome/` 链接 404（Pages 不跟随改名跳转）。`koyome.com` 已被注册，`koyome.me` 可注册未购买。
6. **移动端"缩减而非移除"**——曾直接 `display:none`/early-return 装饰元素（用户反馈"设计都没了"）。现 deco.js 移动端渲染 2 个缩小图形、Q版槽 62px 缩小、悬停反馈改 `:active`。
7. **sticky 页头 z-index 100**——修三点菜单被图片压住点不了（页头与内容同 z-index 1，DOM 序决定覆盖）。`overflow-x: clip` 防横向滚动（`hidden` 会破坏 sticky）。
8. **SSH 推送为正路**——本机 github.com 的 HTTPS 九成丢包（运营商级），SSH(22/443) 畅通；REST API 推送作备胎但 blob ≤37MB。

---

## 3. 待办事项、已知问题与风险

### 3.1 未完成任务（按紧急度）

1. ~~用户新内容未推送上线~~ **✅ 已完成（2026-09-21，提交 `d9228af`）**：电台 4 首新歌、5 个视频、3 部动漫 + 1 角色、2 个 Q版装饰共 25 文件已上线；线上抽查 content/hobbies json 与新素材 200 全过。
2. **koyome.me 域名**：可注册（约 ¥70-120/年），用户未购买。购买后：DNS 加 `CNAME → koyome.github.io`，仓库 Settings → Pages 填自定义域名 + Enforce HTTPS（`koyome.com` 已被注册，放弃）。
3. **旧链接 404**：`https://koyome.github.io/koyome/` 已失效。若用户分享过旧链接，可新建 `Koyome/koyome` 仓库放重定向页（用户决定）。
4. **内容级待办（需用户素材或决定，AI 勿自行处理）**：Q版装饰槽剩 1 空位；旅行照片描绘只有中文（英文可补）；chars 分区第 5 个角色名称暂空；`assets/` 里早期重复上传的同一首歌（`1789830681xxx`/`1789830788xxx`）+ 本次 2 个同名 JPG 待用户决定是否清理。

### 3.2 已知问题（均为有意设计或无害）

- 留言删除无前端入口——有意设计（anon key 无 DELETE 权限），站长用 Supabase 仪表盘删。
- 云端留言板故障/项目暂停时，留言自动回退 localStorage + 内置种子（优雅降级，不报错）。
- 本仓库 `git fetch` 后 `refs/remotes/origin/main` 偶不持久化（junction 路径所致），`git update-ref` 手补即可，纯美观。
- jsdom 测试在 admin 页 gate 会打 "Not implemented: navigation" 噪音——预期行为。

### 3.3 潜在风险

- **Supabase 免费层**：项目连续约 7 天无任何请求可能被暂停（paused）——留言板会静默降级到本地兜底。处理：仪表盘点 Restore 即可恢复，数据不丢。用量（500MB DB / 5GB 带宽）对留言板绰绰有余。
- **GitHub Pages 限额**：100GB 存储 / 100GB/月带宽软限制。当前视频最大 46.8MB，正常使用无虞；若用户传超大视频注意单文件 <100MB（git 限制）。
- **密钥面**：`tools/deploy-key`（SSH 私钥）与 `tools/gh-token.txt`（REST token）在本机明文——绝不外发、绝不入库（已 gitignore）；泄露即去 GitHub Settings 撤销。Supabase `sb_publishable_` key 是公开设计，无需保密，但只有读+写权限。
- **hosts 依赖**：http://Koyome.me 依赖本机 hosts 映射（已配）；换电脑需重跑 `setup-koyome-me.bat`（管理员）。

---

## 4. 环境信息

### 4.1 依赖与配置
- **Node 运行时**：`C:\Users\Public\koyome-node\node.exe`（绿色版；系统 node 亦可，零依赖）。WorkBuddy 托管 node 22 在 `C:\Users\杨坤\.workbuddy\binaries\node\versions\22.22.2-3\node.exe`。
- **PortableGit**：`C:\Users\杨坤\.workbuddy\binaries\PortableGit\versions\1.2.0\cmd\git.exe`（精简版，**无 remote-https helper**——push 必须显式写 SSH 地址，见 §4.3）。
- **jsdom**（测试用）：`C:\Users\杨坤\.workbuddy\binaries\node\workspace\node_modules`（NODE_PATH 指过去）。
- **Supabase**：项目 ref `hvywwgbzzqrwjrxiwfhx`；表 `public.guestbook(id, name≤40, text≤2000, created_at)`，RLS 策略 `anon read`(SELECT) + `anon write`(INSERT)。凭据在 `docs/js/gb-config.js`（可公开）。建表 SQL 存档于 git 历史 `86d3ac6` 及 Supabase SQL Editor。
- **Edge headless**（端到端测试）：`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`，`--headless=new --remote-debugging-port`，Node 22 内置 WebSocket 直连 CDP（参考工作区 `verify-live-cloud.js` / `verify-round2.js`）。

### 4.2 本机运行
- 启动：**双击 `start-hidden.vbs`**（后台无窗口，推荐）或 `start-koyome.bat`（带窗口）；或 `PORT=80 node server.js`（端口被占自动回退 8080）。
- **开机自启已配置**：`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\koyome-site.vbs`（登录时静默启动）。取消=删该文件；停服务=任务管理器结束 node.exe。
- **⚠️ AI 无法在 WorkBuddy 沙箱里代起持久进程**（2026-09-20 实测四条路全灭）：沙箱拉黑 schtasks/wscript/cmd，会话结束回收整棵进程树（run_in_background、detached+unref spawn、Start-Process 均随会话死）。**要"关掉 WorkBuddy 还能访问"，只能用户双击 vbs 或重新登录**。AI 代开的服务仅当前会话有效。
- hosts 已配 `127.0.0.1 Koyome.me`。API 代码改动必须重启服务才生效；docs/ 前端改动刷新即可。

### 4.3 部署到线上（push 后 Pages 约 1 分钟自动重建）

**📌 常驻授权（2026-09-21 用户亲授）**：AI 可随时推送上线，无需逐次请示——内容/功能改动 commit 后直接 push 即可。

**首选 SSH**（本机 SSH 畅通，git smart-HTTP 九成丢包）：
```bash
cd /c/Users/Public/koyome-site
GIT="/c/Users/杨坤/.workbuddy/binaries/PortableGit/versions/1.2.0/cmd/git.exe"
"$GIT" add <files> && "$GIT" commit -m "..."
"$GIT" -c core.sshCommand="ssh -i C:/Users/Public/koyome-site/tools/deploy-key -o UserKnownHostsFile=C:/Users/Public/koyome-ssh/known_hosts -o StrictHostKeyChecking=accept-new" \
  push git@github.com:Koyome/koyome.github.io.git main
```
- 密钥：`tools/deploy-key`（私钥绝不外发）；known_hosts 用 ASCII 路径 `C:/Users/Public/koyome-ssh/known_hosts`（中文用户名 `~` 展开会乱码）。
- **坑：`git push origin main` 会报 `'remote-https' is not a git command`**（origin 是 HTTPS + PortableGit 精简版无 helper）——必须显式写 SSH URL。
- 2026-09-20 曾 `--force-with-lease` 抹平远端分叉（`0b52fbd`），此后普通 push 即可。

**备选 REST**（SSH 失效时）：`powershell -ExecutionPolicy Bypass -File tools\gh-device-auth.ps1`（生成/复用 gh-token.txt）→ `node tools/push-via-api.js`（重放提交保 SHA、断点续传；**blob >37MB 会被 422 拒**，大文件只能走 SSH）。

**兜底**：GitHub Contents API 逐文件 PUT（单文件 <1MB，碎 commit + 哈希分叉，仅应急）。

**推送后验证**：① `git ls-remote git@github.com:Koyome/koyome.github.io.git main` = 本地 HEAD；② 轮询 https://koyome.github.io/ 出现新内容；③ 抽查关键资源 200（含大文件素材各一）。**若 ② 迟迟不出现**：查 Pages 构建状态 `node tools/pages-build-admin.js`——自动构建偶发 `errored`（服务端抖动），`node tools/pages-build-admin.js rebuild` 手动重建一次即可（2026-09-21 实测，§0.10）。

### 4.4 本机网络现状（2026-09-20 实测）
- `github.com` git smart-HTTP：约九成丢包，不可用；**SSH(22/443) 畅通**；`api.github.com` 畅通。
- 跑网络脚本前清空全部代理环境变量：`http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy`（残留 dead proxy `127.0.0.1:61928` 曾致 git 静默 502；`ALL_PROXY` 最隐蔽）。
- 可达：`uploads.github.com`、`objects/raw.githubusercontent.com`、`codeload.github.com`。

### 4.5 开发环境注意事项（本机/本工具链）
- **WorkBuddy Bash 工具缺 coreutils**（ls/grep/head/tail/nul 重定向不可用）——用 shell 内建或 node 一行；`git -C` 不接受 `/c/` 路径，先 `cd`。
- **PowerShell 工具 stdout 偶发不回显且 UTF-16 编码**——关键输出写文件，再用 node 读（BOM 处理：`s[0]===0xFF&&s[1]===0xFE` → `slice(2).toString('utf16le')`）。
- **Edit 工具偶发静默失败**——关键改动后必须 grep/Read 复查落盘。
- 内联 `node -e` 转义地狱——复杂脚本写成临时 .js 再跑。
- PowerShell `Remove-Item` 在工作区曾静默失败——删除用 node `fs.unlinkSync/rmSync`；大目录 rmSync 偶被 SIGTERM，分开单条执行。
- 写 Windows 脚本文件（.bat/.vbs）：内容保持纯 ASCII（非 ASCII 路径会乱码）；写入目标路径含中文无妨（Write 工具处理 Unicode 正常）。

---

## 5. 下一步建议（优先级排序）

1. **P0 — 推送用户新内容上线**（§3.1-1）：与用户确认后直接 commit 全部改动 + 24 个素材，SSH 推送，抽查线上新条目。这既是备份也是上线。
2. **P1 — 自定义域名 koyome.me**：用户购买后，DNS `CNAME → koyome.github.io` + 仓库 Pages 设置 + Enforce HTTPS，全站验证（Supabase 调用不受域名影响——PostgREST 独立域名，天然兼容）。
3. **P2 — 内容收尾**（协助用户，勿代办）：Q版装饰槽第 3 位、chars 第 5 个角色命名、旅行照片英文描绘、重复素材清理决策。
4. **P3 — 可选工程项**：
   - 旧 `/koyome/` 链接重定向仓库（若用户分享过旧链接）；
   - `tools/test-static.js` 扩充断言：首页爱好区、云留言回退链；
   - Supabase 项目防暂停：可设每周一次的自动化访问留言板保持活跃（非必须——暂停也就一键恢复）。
5. **不建议做**：页面过渡动画（用户明确否决过两次）、给留言板加站长前端删除入口（需要暴露更高权限密钥，风险大于收益）、自建后端替代 Supabase（无公网 IP）。

---

## 附录 A 数据模型

### 条目 Entry（content.json 数组元素）
```js
{
  id: 't1',                     // 服务器生成 'c'+base36；种子用 t1/i1/v1
  type: 'text'|'image'|'video', // 音频不是独立 type——音频条目是带 audio 媒体的 text 条目
  title, titleZh,               // 双语标题
  category, categoryZh,         // 双语分类（自由文本）
  date: '2026-09-12',
  featured: true,               // 星标精选
  desc, descZh,                 // 列表摘要
  body, bodyZh,                 // 正文。text 必有；image/video 可选，渲染为素材旁「手記/NOTE」区块
  src: 'assets/xxx',            // = media[0].src，冗余缓存，删 media 时服务端重算
  media: [
    { type: 'image', src: 'assets/xx.png', caption, captionZh },  // 素材描绘（双语）
    { type: 'video', src: 'assets/xx.mp4' },
    { type: 'audio', src: 'assets/xx.mp3', title: '歌名', cover: 'assets/xx.jpg' }  // 音频专有
  ],
  mapPins: {                    // 第十轮新增（仅 i1 用）：旅行地图自建地标
    tokyo: [{ x, y, zh, en }],  // 坐标钳制 0–560 / 0–400，每图 ≤60 枚
    jeju:  [{ x, y, zh, en }]   // 站长在地图上点击添加；游客只读
  }
}
```
### Profile（profile.json）
`name, nameZh, tagline, taglineZh, intro, introZh, avatar, figNote, figNoteZh`（figNote=首页人像注释，空则隐藏，站长双击编辑）
### 爱好（hobbies.json）
```js
{ intro, introZh,
  sections: [ { id: 'anime'|'chars',        // 固定两分区
    items: [{ id, name, nameZh, text, textZh, src }] } ],
  deco: [{ id: 'd1'|'d2'|'d3', src: '' }] } // 3 个 Q版装饰槽
```
### 留言（云表 public.guestbook / 本地 guestbook.json）
云端 `{ id(自增), name, text, created_at }` → 前端映射 `{ id:'sb'+id, name, text, date(本地时区) }`；本地 `{ id, name, text, date }`。

**双语约定**：任何文本字段都可能有 `*Zh` 孪生；`Koyome.loc(item,'title')` 按当前语言取值、空则回退英文。

## 附录 B 本地 API 一览（server.js）

| 方法 | 路径 | 作用 |
|---|---|---|
| GET/POST | `/api/content` | 全部条目 / 新建（可带 `files:[{file:dataURL,filename}]`） |
| PUT/DELETE | `/api/content?id=` | 改文本字段 / 删条目（**不删 assets 文件**） |
| POST | `/api/media` | 条目加素材（音频支持 title+coverFile） |
| PUT/DELETE | `/api/media?id=&index=` | 改/删第 index 个素材（caption/captionZh、音频 title） |
| GET/POST | `/api/profile` | 读/改首页信息（支持 avatarFile dataURL） |
| GET/POST | `/api/hobbies` | 读/整页覆写爱好数据（POST 字段裁剪） |
| POST | `/api/hobbies/upload` | 爱好图片上传 `{file:dataURL,filename}` → `{src}` |
| GET/POST/DELETE | `/api/guestbook` | 本地留言增删查（云模式下仅兜底） |

上传一律 dataURL base64 → `assets/时间戳_文件名.ext`；BODY_LIMIT 200MB；音频 MIME：mp3/wav/ogg/flac/m4a。

## 附录 C 用户内容红线清单（2026-09-21 实盘点，勿删勿重置）

- `t1 電台`：10 首 MP3 全带封面（含未推送的 4 首新歌）。
- `i1 旅行紀錄`：8 图，5 张东京行照片已填中文描绘（东京塔/东大/你的名字取景地/新宿/涩谷）。
- `t2 關於 Koyome`：用户亲笔双语。
- `v1 私人剪輯視頻`：9 个视频（含未推送的 5 个）。
- 爱好页：8 部动漫 + 5 个角色（图+文）；Q版装饰槽已用 2/3。
- 首页：头像 `1789835827804_avatar.png`，intro 用户亲笔。
- 云表留言：欢迎留言（id=2）+ 此后访客真实留言。
- assets 重复文件（早期 2 个同曲 MP3、本次 2 个同名 JPG）——**是否删由用户决定**。

## 附录 D 开发教训（血泪，请继承）

1. 用户数据文件（§0.5 硬规则）是红线：测试一律用临时条目，测完清理并验证原样。
2. 本环境 Edit 偶发静默失败——关键改动后必须验证落盘。
3. 代理环境变量要全清（含 `ALL_PROXY`）——残留 dead proxy 让 git 静默 502，极难排查。
4. `github.com` 与 `api.github.com` 可达性是两回事：前者被丢包，后者畅通；SSH 又另是一路（畅通）。
5. token/密钥出现过就假设已泄露：删文件 + 提醒用户 revoke。
6. jsdom `fromURL` 在 deferred 脚本执行前 resolve——页面断言要等 DOMContentLoaded 或显式 sleep。
7. 让用户复制密钥/长字符串：必须让其用界面的 **Copy 按钮**（用户手抄 JWT 两次串字符，401 排查一轮）；优先选短密钥（`sb_publishable_`）。
8. 验证云端 INSERT 权限可不落数据：故意违反 check 约束，返回 23514 即权限正常（401/42501 才是策略缺失）。
9. infinite CSS 动画只挂可见态选择器；出场动画时长必须 < 跳转延迟。（过渡动画已全拆，存档备用）
10. AI 沙箱起不了持久进程（§4.2）——需要"用户关机重启后仍在"的服务，给用户可双击的脚本，别自己扛。
