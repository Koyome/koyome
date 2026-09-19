# Koyome.me — AI 交接文档（AI Handover）

> 这份文档写给下一个接管本项目的 AI（或人类开发者）。
> 读完这一份，你就拥有了继续开发的全部上下文。
> 最后更新：2026-09-20（第六轮：交接整合 + **部署已完成，本地与线上已同步**）

---

## 0. 给用户的一段现成提示词（可直接贴给下一个 AI）

```
请阅读我项目根目录下的 AI-HANDOVER.md（路径 C:\Users\Public\koyome-site\AI-HANDOVER.md），
它是完整的项目交接文档。读完后再开始改动。硬规则：不要删除或覆盖 docs/assets/ 里
任何已存在的素材文件，不要重置 docs/data/ 下的 json —— 那是我手动上传的真实内容。
改完想上线的话按文档 §9.0 用 SSH 推送（密钥在 tools/deploy-key）。
```

---

## 1. 项目是什么

**Koyome.me** —— 一个双语（English / 繁體中文）极简个人网站，无框架、无构建步骤、零 npm 依赖。

- **线上地址（GitHub Pages）**：https://koyome.github.io/ （2026-09-20 仓库改名为 `koyome.github.io`，从项目页升级为用户主页，原 `/koyome` 路径 GitHub 会自动跳转）
- **仓库**：https://github.com/Koyome/koyome.github.io （public，Pages 从 `main` 分支 `/docs` 目录发布）
- **本机地址**：http://Koyome.me （本地 Node 服务，端口 80；需 hosts 映射，已配置好）
- **管理页**：`/admin.html`（本机版可真正写入数据；线上版改动只存访客自己的 localStorage）

技术栈：纯 HTML/CSS/JS 前端 + 一个零依赖 Node.js `server.js`（静态托管 + JSON API）。

## 2. 硬规则（违反会破坏用户数据）

1. **绝不删除/覆盖 `docs/assets/` 里任何已存在文件** —— 全是用户手动上传的照片、视频、MP3。
2. **绝不重置 `docs/data/` 下的 `content.json`、`profile.json`、`hobbies.json`、`guestbook.json`** —— 全是用户真实内容，不是种子数据。
3. **所有路径保持相对路径**（`assets/...`、`data/...`，不带前导 `/`），否则 GitHub Pages 子路径 `/koyome/` 下会 404。
4. **任何文本字段都要维护双语**：`title/titleZh`、`body/bodyZh` 等。新增 UI 文案必须同时加进 `docs/js/i18n.js` 的 `en` 和 `zh` 两个字典。
5. 改完文件用搜索工具确认改动真的落盘（本环境出现过 Edit 静默失败）。

## 3. 目录结构

```
C:\Users\Public\koyome-site\          ← 项目根（= git 仓库根）
├─ server.js                          本地服务器 + 全部 API（零依赖，~400 行）
├─ start-koyome.bat                   双击启动本机网站（端口 80）
├─ setup-koyome-me.bat                一次性配置：hosts 映射 + 代理绕过（需管理员，已跑过）
├─ AI-HANDOVER.md                     本文档
├─ docs/                              网站本体（GitHub Pages 发布的就是这个目录）
│  ├─ .nojekyll                       必须存在！否则 Pages 的 Jekyll 会吞掉下划线文件
│  ├─ index.html                      首页（个人介绍 + 形象图 + 目录索引区 + 六芒星 sigil）
│  ├─ catalog.html                    目录页（全部条目列表，kinetic title 动效）
│  ├─ entry.html?id=xxx               条目详情页（图文/视频/音乐，素材带描绘）
│  ├─ hobbies.html                    爱好页（动漫/角色两分区 + Q版装饰槽）
│  ├─ guestbook.html                  留言板
│  ├─ admin.html                      管理页（仅站长机可见，游客被重定向）
│  ├─ css/style.css                   全部样式（CSS 变量定义配色，浅色系纸质风）
│  ├─ js/
│  │  ├─ i18n.js                      双语字典 + 语言切换（localStorage: koyome_lang）
│  │  ├─ data.js                      数据层：API 优先，静态托管时回退 localStorage/内置 JSON
│  │  ├─ header.js                    公共头部（导航 + 语言切换；admin 链接仅站长机注入）
│  │  ├─ main.js                      首页逻辑（含目录索引区渲染）
│  │  ├─ catalog.js                   目录页逻辑（双击标题改名，仅站长机）
│  │  ├─ entry.js                     详情页逻辑（音频上传、ID3 封面、素材描绘编辑）
│  │  ├─ hobbies.js                   爱好页逻辑（图文增删改、Q版装饰上传）
│  │  ├─ deco.js                      全站漂浮几何装饰（reduced-motion/移动端自动关）
│  │  ├─ admin.js                     管理页逻辑（顶部有角色 gate）
│  │  └─ guestbook.js                 留言板逻辑（删除按钮仅站长机渲染）
│  ├─ data/
│  │  ├─ content.json                 ★ 全部条目（真实用户数据，勿重置）
│  │  ├─ profile.json                 ★ 首页个人信息（用户改过，勿重置）
│  │  ├─ hobbies.json                 ★ 爱好页数据（用户已填真实内容，勿重置）
│  │  └─ guestbook.json               留言数据
│  └─ assets/                         ★ 全部素材文件（用户上传的图/视频/MP3/封面，勿动）
└─ tools/                             开发辅助脚本（不进网站）
   ├─ test-static.js                  静态渲染回归测试（jsdom）
   ├─ gh-device-auth.ps1              ★ GitHub 设备授权（生成 tools/gh-token.txt）
   ├─ push-via-api.js                 ★ 走 REST API 的推送（本机 github.com 被墙时的正路）
   ├─ test-render.js / verify.js      渲染/验证脚本
   ├─ fix-git.js                      git 配置修复（历史遗留）
   └─ make-avatar.py                  形象图生成脚本
```

注意：`C:\Users\杨坤\WorkBuddy\2026-09-19-19-30-28\koyome\` 与 `C:\Users\Public\koyome-site\` 是同一目录（junction）。**统一用 `C:\Users\Public\koyome-site\` 作为工作路径。**

## 4. 架构：一个代码库，两种运行模式

`docs/js/data.js` 是理解全站的钥匙。它在运行时探测 `api/content` 是否存在：

| | 本机模式（server.js 运行中） | 静态模式（GitHub Pages） |
|---|---|---|
| 数据来源 | Node API 读写 `docs/data/*.json` | 先 localStorage 覆盖层，再 `data/*.json` |
| 管理页改动 | **真正写入磁盘**，全访客可见 | 只存自己浏览器 localStorage |
| 上传素材 | 写入 `docs/assets/` | 不可用（无后端） |
| 留言 | 写入 `guestbook.json` | 只存 localStorage |

**推论**：线上站是只读快照。更新线上内容的正确流程 = 本机改 → git commit → push → Pages 自动重建。

## 5. 数据模型

### 条目 Entry（content.json 数组元素）
```js
{
  id: 't1',                    // 服务器生成 'c'+base36；种子用 t1/i1/v1
  type: 'text'|'image'|'video',// 注意：音频不是独立 type，音频条目是带 audio 媒体的 text 条目
  title, titleZh,              // 双语标题
  category, categoryZh,        // 双语分类（自由文本，如 Essays/隨筆）
  date: '2026-09-12',
  featured: true,              // 首页/目录是否置顶星标
  desc, descZh,                // 列表页摘要
  body, bodyZh,                // 正文。text 类型必须有；image/video 类型可选，
                               //   有内容时在前端渲染为素材旁的「手記/NOTE」设计区块
  src: 'assets/xxx',           // = media[0].src，冗余缓存，删 media 时服务端会重算
  media: [                     // 素材数组（图/视频/音频混排）
    { type: 'image', src: 'assets/xx.png',
      caption, captionZh },    // ★ 2026-09-20 新增：素材描绘（双语，详情页素材旁可双击编辑）
    { type: 'video', src: 'assets/xx.mp4' },
    { type: 'audio', src: 'assets/xx.mp3',
      title: '歌名',           // 音频专有：曲名
      cover: 'assets/xx.jpg' } // 音频专有：封面（来自 ID3 或手动选择）
  ]
}
```

### Profile（profile.json）
`name, nameZh, tagline, taglineZh, intro, introZh, avatar`

### 爱好（hobbies.json，第三轮重构后的结构）
```js
{
  intro, introZh,
  sections: [           // 固定两个分区：anime（喜歡的動漫）、chars（動漫角色）
    { id: 'anime'|'chars',
      items: [{ id, name, nameZh, text, textZh, src: 'assets/xx.jpg' }] }  // src=配图，可空
  ],
  deco: [{ id: 'd1'|'d2'|'d3', src: '' }]  // 3 个 Q版人物装饰槽位，src 空=未放置
}
```
用户已填入真实内容（5 部动漫 + 4 个角色，均带图带文），**勿重置**。deco 三槽目前为空。

### 留言（guestbook.json）
`{ id, name, text, date }`

## 6. 本地 API 一览（server.js）

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/api/content` | 全部条目 |
| POST | `/api/content` | 新建条目（可带 `files:[{file:dataURL,filename}]`） |
| PUT | `/api/content?id=` | 改文本字段（body 对所有类型开放；text 类型 body 不能清空） |
| DELETE | `/api/content?id=` | 删条目（**不删 assets 文件**） |
| POST | `/api/media` | 给条目加素材：`{id, files:[{file,filename,title?,coverFile?}]}`，音频支持 title+coverFile |
| PUT | `/api/media?id=&index=` | 改第 index 个素材的 `caption/captionZh`（音频还可改 `title`） |
| DELETE | `/api/media?id=&index=` | 删条目里第 index 个素材 |
| GET/POST | `/api/profile` | 读/改首页信息（POST 支持 `avatarFile` dataURL） |
| GET/POST | `/api/hobbies` | 读/整页覆写爱好页数据 `{intro,introZh,sections[],deco[]}`（POST 会做字段裁剪） |
| POST | `/api/hobbies/upload` | 爱好页图片上传 `{file:dataURL,filename}` → 返回 `{src}`（条目图与 Q版装饰共用） |
| GET/POST/DELETE | `/api/guestbook` | 留言增删查 |

- 上传一律用 **dataURL base64**，`saveDataUrl()` 落盘到 `assets/时间戳_文件名.ext`，BODY_LIMIT 200MB。
- 音频 MIME 已支持：mp3/wav/ogg/flac/m4a。

## 7. 前端约定

- 两个全局对象：`window.Koyome`（data.js，数据层）和 `window.I18N`（i18n.js，`t(key)` 取词、`lang` 当前语言）。
- HTML 里用 `data-i18n="key"` / `data-i18n-ph="key"`（placeholder）声明文案，JS 动态内容用 `t('key')`。
- 取双语字段统一用 `Koyome.loc(item, 'title')`（自动按当前语言选 titleZh/title，空则回退英文）。
- 详情页音频渲染为 `.track-card`（封面 + 曲名 + `<audio controls>`）；无封面时用内联 SVG 兜底。
- 图片/视频条目的 body 渲染为 `.entry-note`（NOTE/手記 标签 + 正文），与素材相辅相成——这是用户明确要求的设计，改动时保持这个调性。
- 设计语言参考：浅纸色底、衬线标题、等宽小标签、红色 accent（`--accent: #9e2b25`），参考 1uvng.me 的安静极简风。

### 2026-09-20 第二轮新增（本机已验证，未 push）
- **目录页 kinetic title index**（catalog.js）：逐字模糊上浮入场、行级 IntersectionObserver reveal、悬停渐变扫光+下划线绘制+箭头、ghost 序号滚动视差；站长模式（API 存活时）**双击标题内联改名**（PUT 仅传当前语言字段）。
- **详情页素材描绘**（entry.js）：每个素材旁 `.media-cap`（CAPTION/描繪 标签 + 双语 caption），站长模式双击编辑（PUT /api/media）；条目标题/简介同样双击即改。
- **素材多样布局**：`.media-stack` 改 12 列网格，lay-a/b/c/d/wide/track 类循环指派（错落、偏移、宽窄混搭），音频恒通栏；素材框加红色角标 tick。
- **爱好页** `hobbies.html` + `hobbies.js` + `data/hobbies.json` + `/api/hobbies`：错落卡片 + 循环几何 SVG 图腾，全字段双击编辑、可增删；导航菜单已接入（header.js PAGES，nav_hobbies 词条）。
- **动态装饰** `deco.js`（全站挂载）：8 种不规则线框几何形按页面预置 2–3 个，正弦漂移 + 慢旋转 + 鼠标反向视差；`pointer-events:none`、内容 z-index 之上层叠为 1、移动端/减少动态偏好自动关闭。
- reveal/入场统一缓动 `cubic-bezier(.22,.8,.3,1)`（借鉴 1uvng.me 的 .reveal/signal-in）；所有 reveal 元素完成后加 `.settled` 清零 transition-delay 保证悬停即时响应。

### 2026-09-20 第五轮：游客/管理员条件渲染（游客纯只读）
- 角色判定沿用既有机制：本地 API 存活 = 管理员（站长机），静态托管（GitHub Pages）= 游客。
- **header.js**：菜单不再静态渲染「管理」链接；`maybeRevealAdmin()` 轮询等 Koyome 就绪 → `apiAvailable()` 为真才追加 admin 链接（编号 05），游客永远没有该入口。
- **admin.html/admin.js**：两个 `.admin-wrap` 默认 `hidden`；admin.js 顶部 `gate()` 非管理员 `location.replace('index.html')`，通过才揭开。
- **entry.html/entry.js**：`#ownerTools` 默认 `hidden`（之前对游客可见！），canEdit 才显示；`.media-del` 删除按钮仅 canEdit 渲染；无 caption 的素材游客不再渲染 `.media-cap` 空块。
- **guestbook.js**：`.gb-del` 仅 canEdit 渲染（之前所有访客可见删除按钮）。
- **hobbies.js**：空图框的 "+" 路径仅 canEdit 渲染（游客只看圆圈）；空分区文案分角色——游客 `hob_empty_guest`（"Nothing here yet."），管理员仍是添加引导。
- 验证：test 双视角 34 项全过（游客 6 页零编辑痕迹 + 管理员全功能）；静态回归 22 项全过（期望值已同步用户当前真实内容：t1 分类 Music/音乐、zh 标题「電台」、body 含 playlist/歌單）。
- 注意：静态模式下 admin 页 gate 会触发 jsdom "Not implemented: navigation" 噪音——预期行为（游客被重定向）。

### 2026-09-20 第三轮：爱好页重构（动漫主题）+ 首页目录区
- **爱好页推倒重做**：旧的四分类卡片废弃，改为固定两分区「喜歡的動漫 anime / 動漫角色 chars」，数据驱动（结构见 §5）。每个条目=图+文流动布局：页面中央虚线「河流」，条目左右交错排布、交汇处红节点，图片轻微倾斜悬停回正；图片框点击上传（/api/hobbies/upload），名称/介绍双击编辑，条目可增删。
- **Q版人物装饰槽**：页面 3 个虚线圆圈槽位（deco d1/d2/d3），点击放入图片后缓慢漂浮，悬停可替换/移除；移动端隐藏，不挡内容。
- **首页目录区**：hero 与六芒星之间新增「目錄 CATALOG」索引区（条目大字列表 + 查看全部链接，逐行 reveal），main.js renderCatalog() 渲染。
- 用户反馈记录：不要预设爱好分类内容（上一版的音樂/繪畫等占位被否），爱好=动漫向，编辑自由度优先。

### 2026-09-20 第四轮：页面过渡动画 —— 已应用户要求全部拆除
- 曾两版实现（v1 淡入淡出被反馈"卡、不完整"；v2 几何薄纱+缓冲进度条+百分比修好后用户仍决定**不要任何页面间过渡**），现已全部移除：无 `.pt-*/.pv-*` markup/CSS、无 `js/transitions.js`、无相关 i18n 词条，grep 零残留；6 页冒烟 + 22 项静态回归全过。
- 全站唯一加载动画 = 首页原始 `.loader`，保持原样勿动。
- 教训存档：① infinite CSS 动画只挂可见态选择器，否则隐藏时仍耗合成；② 出场动画时长必须 < 跳转延迟；③ jsdom fromURL 在 deferred 脚本执行前 resolve，断言要等 DOMContentLoaded。

## 8. 本机运行

- Node 运行时：`C:\Users\Public\koyome-node\node.exe`（绿色版副本；用系统 node 也行，无依赖）。
- 启动：双击 `start-koyome.bat`，或 `PORT=80 node server.js`（端口被占自动回退 8080）。
- hosts 已配置 `127.0.0.1 Koyome.me`（setup-koyome-me.bat 跑的，只需一次）。
- 重启服务：杀掉占用 80 端口的 node 进程再启动（API 代码改动必须重启才生效；docs/ 下前端改动刷新即可）。

## 9. 部署到线上

Pages 从 `main` 分支 `/docs` 自动重建（push 后约 1 分钟），无构建步骤。

### 9.0 首选：SSH 原生推送（2026-09-20 已打通，最可靠）
- 本机 `github.com:22` 与 `ssh.github.com:443` 的 SSH 均可直连（git smart-HTTP 反而被丢包）。
- 密钥：`tools/deploy-key` + `tools/deploy-key.pub`（均已 gitignore），公钥已登记在用户 GitHub 账号（Settings → SSH keys，标题 koyome-deploy 或 koyome-deploy-20260920）。**私钥绝不外发、绝不入库。**
- 推送命令模板：
```bash
GIT_SSH_COMMAND='"<PortableGit>/usr/bin/ssh.exe" -i "C:\Users\Public\koyome-site\tools\deploy-key" -o IdentitiesOnly=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null' \
git push git@github.com:Koyome/koyome.github.io.git main:main
```
- 2026-09-20 曾用 `--force-with-lease` 覆盖远端 `0b52fbd`（历史遗留的 API 分叉提交），之后本地/远端历史完全一致，普通 push 即可。
- **坑：`origin` remote 是 HTTPS 地址，而本机 PortableGit 精简版没有 remote-https helper**，`git push origin main` 会报 `'remote-https' is not a git command`——必须像上面模板那样显式写 SSH 地址 `git@github.com:Koyome/koyome.github.io.git`。
- 手机版适配已完成（2026-09-20，提交 `6d03695`）：页头 sticky + z-index 100（修三点菜单被图片遮挡）；`deco.js` 不再对 ≤720px 直接 return，改渲染 2 个缩小图形；Q 版装饰层手机端缩小显示；验证方式见工作区 `mobile-verify.js` 思路（Edge headless + CDP，`Emulation.setDeviceMetricsOverride` 375×812 + `elementFromPoint` 命中测试）。
- 备用 token（REST 用）：`tools/gh-token.txt`（gitignore，scope=repo）。撤销入口：GitHub Settings → Applications → Authorized OAuth Apps。

### 9.1 本机网络现状（2026-09-20 实测，重要）
- **`github.com` 的 git smart-HTTP 基本不可用**：TCP SYN 约九成被丢包（`Failed to connect after 21s` / 偶发 `expected flush after ref listing`），重试 10 次全部失败；但 **SSH(22/443) 畅通**，推送一律走 §9.0。
- **`api.github.com` 畅通**：node fetch 与 PowerShell Invoke-RestMethod 均稳定 200。REST 推送（§9.2）可作 SSH 失效时的备胎，但 **blob API 实测上限约 37MB 原始文件**（37.1MB 成功 / 46.8MB 返回 422 too large，即 base64 后 ~50MB 封顶）。
- 跑任何网络脚本前清空全部代理环境变量：`http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy`（本机残留过已死的 `127.0.0.1:61928`，git 会静默走它报 502；`ALL_PROXY` 是最隐蔽的元凶）。
- `github.com` 网页/登录端点偶发可达（设备授权码一次成功一次 40 次重试），授权脚本要带重试。
- 可达性备忘：`uploads.github.com`、`objects.githubusercontent.com`、`raw.githubusercontent.com`、`codeload.github.com` 均可达。

### 9.2 备选：REST API 推送（SSH 失效时）
```powershell
# 1) 授权（如 tools/gh-token.txt 已存在可跳过；生成它的脚本带重试）
powershell -ExecutionPolicy Bypass -File tools\gh-device-auth.ps1
# 2) 推送（走 REST Git Data API，幂等 + 断点续传，进度存 tools/push-state.json）
node tools/push-via-api.js
```
- `push-via-api.js` 把本地 `main` 上远端缺失的提交**原样重放**（blob→tree→commit，保留 message/author/committer），更新 `refs/heads/main`，并用 `git commit-tree` 在本机重建相同对象对齐 SHA（有校验）。
- **blob >37MB 会被 GitHub 拒（422 too large）**，脚本会跳过并记入 `push-state.json` 的 `tooLarge`，这些文件只能走 SSH（§9.0）。
- **token 绝不写进 git 历史/remote URL**；泄露即删文件 + 提醒用户去 GitHub Settings → Applications 撤销。

### 9.3 如果 REST 也不通（兜底）
GitHub Contents API 逐文件 PUT（`PUT /repos/Koyome/koyome.github.io/contents/<path>`，base64，branch=main，单文件 <1MB）。会产生大量碎 commit 且哈希分叉，仅应急。

### 9.4 推送后验证
1. `git ls-remote git@github.com:Koyome/koyome.github.io.git main` = 本地 HEAD。
2. 轮询 https://koyome.github.io/ 直到出现新内容（约 1 分钟）。
3. 抽查关键资源 200：`hobbies.html`、`js/hobbies.js`、`data/hobbies.json`、大文件素材各一。

## 10. 当前状态快照（2026-09-20 凌晨，部署完成）

### Git / 部署
- **✅ 部署已完成**：本地 main 与 GitHub `origin/main` 均在 `35fe384`（内容完全一致，SHA 相同）；GitHub Pages 新构建已上线（hobbies/catalog/详情页/全部素材抽查 200 通过）。
- 历史分叉已用 `--force-with-lease` 一次性抹平（远端 `0b52fbd` 被覆盖）；此后普通 `git push`（SSH，§9.0）即可。
- 推送通道：SSH 密钥 `tools/deploy-key`（公钥已登记用户账号）；备用 REST token `tools/gh-token.txt`。两者均 gitignore。

### 用户内容（全部真实数据，红线勿动）
- `t1 電台`：6 首 MP3 全带封面（Reynard Silva、mixed matches、kuudere existence、palefire Not on ur way、Kanye Only One、Come to Life）。
- `i1 旅行紀錄`：8 图，其中 5 张东京行照片**已填描绘**（东京塔/东京大学/你的名字取景地/新宿/涩谷十字路口，目前只填了中文）。
- `t2 關於`、`v1 私人剪輯`（4 视频，最大 46.8MB 已经 SSH 推送上线）。
- 爱好页：5 部动漫（Clannad/物语系列/命运石之门/Re:0/无职转生）+ 4 个角色（爱蜜莉亚/泉此方/艾莉丝/夏娜），图+文已填；3 个 Q版装饰槽仍空。
- 首页：头像已换 `1789835827804_avatar.png`，intro 双语为用户亲笔。
- assets 里 `1789830681xxx` 与 `1789830788xxx` 是同一首歌的两次上传（重复）——是否清理由用户决定，不要自行删。

### 功能状态
- 全站游客纯只读（第五轮）：管理入口/编辑按钮/上传区/占位提示仅站长机（本地 API 存活）可见；34 项双视角测试 + 22 项静态回归全过。
- 页面间无过渡动画（用户明确要求，已拆除干净）；唯余首页原始 loader。
- 本地服务器可能未运行：双击 `start-koyome.bat` 即可（端口 80）。

### 环境备忘（本机）
- PowerShell 工具 stdout 偶发不回显——关键输出写文件再 Read。
- git 用 PortableGit：`C:\Users\杨坤\.workbuddy\binaries\PortableGit\versions\1.2.0\mingw64\bin\git.exe`；SSH 工具在同包 `usr\bin\ssh.exe` / `ssh-keygen.exe`。
- `ssh -T git@github.com` 报 "Could not create directory '/c/Users/...'“ 无害（中文用户名路径），看到 `Hi Koyome!` 即认证成功。
- jsdom 在 `C:\Users\杨坤\.workbuddy\binaries\node\workspace\node_modules`（NODE_PATH 指过去跑测试）。
- 已知小毛病：本仓库 `git fetch` 后 `refs/remotes/origin/main` 偶不持久化（junction 路径所致），用 `git update-ref` 手动补即可（纯美观问题）。

## 11. 测试

- `tools/test-static.js`：起本地静态服务器 + jsdom 跑双语渲染回归（首页/目录/详情/留言/管理页）。用法：
  `NODE_PATH=<全局node_modules含jsdom> node tools/test-static.js`
- jsdom 安装在 `C:\Users\杨坤\.workbuddy\binaries\node\workspace\node_modules`。
- 改 API 后用 curl/fetch 直接打 `http://Koyome.me/api/...` 验证，记得建临时条目测完删掉。

## 12. 开发教训（血泪，请继承）

1. 本环境 Edit 工具偶发静默失败——**关键改动后必须搜索标记串验证落盘**。
2. 内联 `node -e "..."` 在 bash 里转义地狱——复杂脚本**写成临时 .js 文件再跑**。
3. grep 管道会吞掉 git 的错误输出——调试 git 时看原始输出。
4. token/密钥出现过就必须假设已泄露：删本地文件 + 提醒用户 revoke。
5. 用户的数据文件（§2）是红线，测试一律用临时条目，测完清理并验证用户数据原样。
6. **代理环境变量要全清**（含 `ALL_PROXY`/`all_proxy`）——只清 http_proxy 不够，残留的 dead proxy 会让 git 走 502 且难以排查。
7. 本机 `github.com` 与 `api.github.com` 可达性完全两回事：前者被运营商级丢包，后者畅通。需要 GitHub 写操作时直接放弃 git 协议，用 REST Git Data API 重放提交（blob/tree/commit SHA 可精确复现，见 tools/push-via-api.js）。
8. `git commit-tree` 配合 `GIT_AUTHOR_*/GIT_COMMITTER_*` 环境变量可以逐比特复刻一个 commit（SHA 相同）——本地/远端对齐就靠它。
9. jsdom 的 `fromURL` 会在 deferred 脚本执行前 resolve——页面级测试的断言要等 DOMContentLoaded 或显式 sleep。
