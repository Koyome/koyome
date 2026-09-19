# Koyome.me — AI 交接文档（AI Handover）

> 这份文档写给下一个接管本项目的 AI（或人类开发者）。
> 读完这一份，你就拥有了继续开发的全部上下文。
> 最后更新：2026-09-20（第五轮：游客/管理员条件渲染；第四轮过渡动画已拆除）

---

## 0. 给用户的一段现成提示词（可直接贴给下一个 AI）

```
请阅读我项目根目录下的 AI-HANDOVER.md（路径 C:\Users\Public\koyome-site\AI-HANDOVER.md），
它是完整的项目交接文档。读完后再开始改动。硬规则：不要删除或覆盖 docs/assets/ 里
任何已存在的素材文件，不要重置 docs/data/content.json —— 那是我手动上传的真实内容。
```

---

## 1. 项目是什么

**Koyome.me** —— 一个双语（English / 繁體中文）极简个人网站，无框架、无构建步骤、零 npm 依赖。

- **线上地址（GitHub Pages）**：https://koyome.github.io/koyome/
- **仓库**：https://github.com/Koyome/koyome （public，Pages 从 `main` 分支 `/docs` 目录发布）
- **本机地址**：http://Koyome.me （本地 Node 服务，端口 80；需 hosts 映射，已配置好）
- **管理页**：`/admin.html`（本机版可真正写入数据；线上版改动只存访客自己的 localStorage）

技术栈：纯 HTML/CSS/JS 前端 + 一个零依赖 Node.js `server.js`（静态托管 + JSON API）。

## 2. 硬规则（违反会破坏用户数据）

1. **绝不删除/覆盖 `docs/assets/` 里任何已存在文件** —— 全是用户手动上传的照片、视频、MP3。
2. **绝不重置 `docs/data/content.json`、`profile.json`、`guestbook.json`** —— 是用户真实内容，不是种子数据。
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
│  ├─ index.html                      首页（个人介绍 + 形象图 + 六芒星 sigil）
│  ├─ catalog.html                    目录页（全部条目列表）
│  ├─ entry.html?id=xxx               条目详情页（图文/视频/音乐）
│  ├─ guestbook.html                  留言板
│  ├─ admin.html                      管理页（增删改条目、传素材、改首页、管留言）
│  ├─ css/style.css                   全部样式（CSS 变量定义配色，浅色系纸质风）
│  ├─ js/
│  │  ├─ i18n.js                      双语字典 + 语言切换（localStorage: koyome_lang）
│  │  ├─ data.js                      数据层：API 优先，静态托管时回退 localStorage/内置 JSON
│  │  ├─ header.js                    公共头部（导航 + 语言切换按钮）
│  │  ├─ main.js                      首页逻辑
│  │  ├─ catalog.js                   目录页逻辑
│  │  ├─ entry.js                     详情页逻辑（含音频上传、ID3 封面提取）
│  │  ├─ admin.js                     管理页逻辑
│  │  └─ guestbook.js                 留言板逻辑
│  ├─ data/
│  │  ├─ content.json                 ★ 全部条目（真实用户数据，勿重置）
│  │  ├─ profile.json                 ★ 首页个人信息（用户改过，勿重置）
│  │  └─ guestbook.json               留言数据
│  └─ assets/                         ★ 全部素材文件（用户上传的图/视频/MP3/封面，勿动）
└─ tools/                             开发辅助脚本（不进网站）
   ├─ test-static.js                  静态渲染回归测试（jsdom）
   ├─ test-render.js                  渲染测试
   ├─ verify.js                       验证脚本
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

### 爱好（hobbies.json，2026-09-20 新增）
`{ intro, introZh, items: [{ id, name, nameZh, text, textZh }] }`——爱好页整页数据，初始为占位种子，用户可改。

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
| GET/POST | `/api/hobbies` | 读/整页覆写爱好页数据 `{intro,introZh,items[]}`（POST 会做字段裁剪） |
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

1. `git add -A && git commit`
2. push 到 `origin main`（https://github.com/Koyome/koyome.git）
3. Pages 自动重建（约 1 分钟），无需其他操作。

**认证状态**：上次部署用的 OAuth device-flow token 已删除并建议用户撤销过。**push 前需要重新授权**：
- 用 GitHub device flow：client_id `178c6fc778ccc68e1d6a`（GitHub CLI 的公共 client_id），POST `https://github.com/login/device/code` 拿 device_code → 让用户在浏览器打开验证页输入码 → POST `https://github.com/login/oauth/access_token` 换 token（scope 需 `repo`）。
- 或者让用户提供 PAT。
- **token 绝不写进 git 历史/remote URL**（曾发生过，已清理）。push 用 `git -c credential.helper= push https://x-access-token:<TOKEN>@github.com/... main`，用完即弃，并检查 `.git/config` 无残留。

**本机网络坑**：系统代理会让 git push 报 502。对策：重试几次，或清空 `http_proxy/https_proxy` 环境变量再推；实在不行用 GitHub Contents API 直接 PUT 文件兜底（会造成本地与远端 commit 哈希分叉，下次 push 前 `git fetch && git reset --hard origin/main` 对齐）。

## 10. 当前状态快照（2026-09-20）

- **本地领先线上 2 大块**：① 第一轮 c66428d（音频+封面+手记区块+素材）② 第二轮未 commit（目录动效+素材描绘+爱好页+deco 装饰+API 扩展）。**全部尚未 push**（等重新授权）。线上站目前还是旧版。
- content.json 里 `t1 深夜電台` 已挂 2 首 MP3（Reynard Silva、mixed matches），带封面。
- 素材 caption 字段已上线（API + 前端），用户尚未填写——4 个条目的素材目前都是空描绘，等用户双击填写。
- hobbies.json 第三轮已重构为动漫主题空模板（anime/chars 两分区 + 3 个Q版装饰槽），等用户填入自己的内容。
- assets 里有一组重复文件（`1789830681xxx` 与 `1789830788xxx` 是同一首歌的两次上传）——是否清理由用户决定，不要自行删。
- 已知小分叉：`.nojekyll` 那个 commit 本地与 GitHub 哈希不同（API 上传所致），下次 push 前按 §9 对齐。

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
