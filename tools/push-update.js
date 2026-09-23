#!/usr/bin/env node
/* ============================================================
   push-update.js — Koyome.me 一键推送网站更新
   流程：环境检查 → 检测本地修改 → commit → 与远程比对
        → SSH push（冲突时自动 pull --rebase 一次）→ ls-remote 核对
   跨平台（Windows / macOS / Linux），通常由 push-update.bat
   或 push-update.sh 调用，也可直接运行：
     node tools/push-update.js            正式推送
     node tools/push-update.js --dry-run  演练（只检测，不提交不推送）
   设计依据：AI-HANDOVER.md §4.3（SSH 推送正路、推送后必须
   ls-remote 核对）与 §4.4（清空全部代理环境变量）。
   ============================================================ */
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* 优先用纯 ASCII 的 junction 路径作为仓库根：
   真实目录在中文用户名下，ssh 读密钥走 ASCII 路径最稳（§4.3/§4.4 教训） */
const ASCII_ALIAS = 'C:/Users/Public/koyome-site';
let ROOT = path.resolve(__dirname, '..');
if (process.platform === 'win32' && fs.existsSync(path.join(ASCII_ALIAS, 'server.js'))) {
  ROOT = ASCII_ALIAS;
}
const REMOTE = 'git@github.com:Koyome/koyome.github.io.git';
const BRANCH = 'main';
const SITE_URL = 'https://koyome.github.io/';
const SSH_KEY = path.join(ROOT, 'tools', 'deploy-key');
const WIN_KH_DIR = 'C:/Users/Public/koyome-ssh';
const KNOWN_HOSTS = process.platform === 'win32'
  ? WIN_KH_DIR + '/known_hosts'
  : path.join(os.homedir(), '.ssh', 'known_hosts');
const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('-n');

const PUSH_TIMEOUT = 10 * 60 * 1000; /* 大文件推送最多等 10 分钟 */
const NET_TIMEOUT = 60 * 1000;

let GIT = null;
const LINE = '='.repeat(54);

/* ---------------- 输出助手 ---------------- */
function step(n, total, msg) { console.log('\n[' + n + '/' + total + '] ' + msg); }
function ok(msg) { console.log('  [OK] ' + msg); }
function fail(title, detail, advice) {
  console.log('\n' + LINE);
  console.log('  [失败] ' + title);
  console.log(LINE);
  if (detail && String(detail).trim()) {
    console.log('\n【错误详情】（末尾几行最关键）');
    console.log(String(detail).trim().split('\n').slice(-12).join('\n'));
  }
  if (advice) {
    console.log('\n【解决建议】');
    for (const a of [].concat(advice)) console.log('  · ' + a);
  }
  console.log('\n窗口不会自动关闭，可将以上信息截图发给维护 AI。');
  process.exitCode = 1;
}

/* ---------------- 环境 ---------------- */
function findGit() {
  const home = os.homedir();
  const candidates = process.platform === 'win32'
    ? ['git',
       path.join(home, '.workbuddy', 'binaries', 'PortableGit', 'versions', '1.2.0', 'cmd', 'git.exe'),
       'C:/Program Files/Git/cmd/git.exe',
       'C:/Program Files (x86)/Git/cmd/git.exe']
    : ['git', '/usr/bin/git', '/usr/local/bin/git', '/opt/homebrew/bin/git'];
  for (const c of candidates) {
    try {
      const r = spawnSync(c, ['--version'], { encoding: 'utf8' });
      if (!r.error && r.status === 0) return c;
    } catch (_) { /* try next */ }
  }
  return null;
}

/* 清空全部代理环境变量（残留 dead proxy 曾让 git 静默 502） */
function cleanEnv() {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/proxy/i.test(k)) delete env[k];
  return env;
}

function run(args, timeoutMs) {
  const r = spawnSync(GIT, args, {
    cwd: ROOT, encoding: 'utf8', env: cleanEnv(),
    timeout: timeoutMs || 120000,
  });
  return {
    code: r.status == null ? -1 : r.status,
    out: ((r.stdout || '') + (r.stderr || '')),
    timedOut: !!(r.error && r.error.code === 'ETIMEDOUT'),
  };
}

const fwd = (p) => p.replace(/\\/g, '/');
function sshArgs() {
  return ['-c', 'core.sshCommand=ssh -i ' + fwd(SSH_KEY) +
    ' -o UserKnownHostsFile=' + fwd(KNOWN_HOSTS) +
    ' -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20'];
}

function ts() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
    ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

/* ---------------- 错误分类 ---------------- */
const NET_ADVICE = [
  '检查电脑是否联网；若开着代理 / VPN，尝试切换节点或关闭后重试。',
  '稍等片刻直接重新运行本脚本即可（偶发抖动很常见）。',
];
function classify(out) {
  const t = out || '';
  if (/Permission denied \(publickey\)/i.test(t)) return {
    title: '认证失败（SSH 密钥被 GitHub 拒绝）',
    advice: [
      '部署公钥可能已从 GitHub 移除：把 tools/deploy-key.pub 的内容重新添加到 GitHub → 头像 → Settings → SSH and GPG keys。',
      '或把本窗口信息发给维护 AI，重新走一次授权流程。',
    ] };
  if (/Repository not found/i.test(t)) return {
    title: '找不到远程仓库（仓库被改名/删除，或密钥无权限）',
    advice: ['确认 GitHub 上 Koyome/koyome.github.io 仓库仍存在，且该密钥有写权限。'] };
  if (/Could not resolve hostname|Temporary failure in name resolution|Name or service not known/i.test(t)) return {
    title: '网络异常（无法解析 github.com）', advice: NET_ADVICE };
  if (/Connection (timed out|refused|reset)|ssh_exchange_identification|Network is unreachable|connect to host/i.test(t)) return {
    title: '网络异常（SSH 无法连接 GitHub）',
    advice: NET_ADVICE.concat(['若当前网络屏蔽了 22 端口（校园网/公司网常见），换手机热点再试。']) };
  if (/Host key verification failed/i.test(t)) return {
    title: 'SSH 主机指纹校验失败',
    advice: ['删除这个文件后重试：' + KNOWN_HOSTS] };
  if (/non-fast-forward|fetch first|rejected/i.test(t)) return {
    title: '远程冲突（线上有你本地没有的提交）',
    advice: [
      '你的本地修改都还在，没有丢失。',
      '建议把本窗口信息发给维护 AI 手动 rebase；或确认无冲突后在项目目录运行 git pull --rebase 再重跑本脚本。',
    ] };
  if (/Please tell me who you are|unable to auto-detect email/i.test(t)) return {
    title: 'Git 身份未配置（无法提交）',
    advice: [
      '在项目目录运行：git config user.name "Koyome"',
      '再运行：git config user.email "koyome@localhost"，然后重跑本脚本。',
    ] };
  return {
    title: '推送失败（未识别的错误）',
    advice: ['先重新运行一次本脚本。', '仍失败请把上面【错误详情】截图发给维护 AI。'] };
}

/* ---------------- 主流程 ---------------- */
function main() {
  console.log(LINE);
  console.log('  Koyome.me 一键推送更新');
  console.log(LINE);
  if (DRY_RUN) console.log('  （演练模式：只检测与比对，不提交、不推送）');

  /* 1. 环境检查 */
  step(1, 5, '检查运行环境…');
  GIT = findGit();
  if (!GIT) {
    return fail('找不到 Git', '', [
      '请安装 Git for Windows（或恢复 .workbuddy 目录下的 PortableGit），然后重试。',
    ]);
  }
  ok('Git: ' + GIT);
  const inside = run(['rev-parse', '--is-inside-work-tree']);
  if (inside.code !== 0 || !/true/.test(inside.out)) {
    return fail('当前目录不是 git 仓库', ROOT, '脚本必须位于 Koyome 项目内（tools/ 下），请勿移动单个文件。');
  }
  ok('仓库: ' + ROOT);
  if (process.platform === 'win32') {
    try { fs.mkdirSync(WIN_KH_DIR, { recursive: true }); } catch (_) { /* ignore */ }
  }
  if (!fs.existsSync(SSH_KEY)) {
    return fail('找不到部署密钥 tools/deploy-key', '', [
      '该私钥用于 SSH 推送认证，且不应入库。',
      '若被误删：需要重新生成密钥对并把公钥登记到 GitHub（联系维护 AI 处理）。',
    ]);
  }
  ok('部署密钥就位');

  /* 2. 检测本地修改 */
  step(2, 5, '检测本地修改…');
  const st = run(['-c', 'core.quotepath=false', 'status', '--porcelain']);
  if (st.code !== 0) return fail('无法读取仓库状态', st.out, '把错误详情发给维护 AI。');
  const changed = st.out.split('\n').filter((l) => l.trim());
  if (changed.length) {
    console.log('  发现 ' + changed.length + ' 处修改：');
    changed.slice(0, 12).forEach((l) => console.log('    ' + l));
    if (changed.length > 12) console.log('    ……共 ' + changed.length + ' 处');
  } else {
    ok('没有未提交的修改');
  }

  /* 3. 提交 */
  let committed = false;
  step(3, 5, changed.length ? '提交修改（commit）…' : '提交修改（无需提交）');
  if (changed.length && !DRY_RUN) {
    const add = run(['add', '-A']);
    if (add.code !== 0) return fail('暂存修改失败（git add）', add.out, '把错误详情发给维护 AI。');
    const msg = 'Site update ' + ts() + ' (auto, ' + changed.length + ' files)';
    const ci = run(['commit', '-m', msg]);
    if (ci.code !== 0) {
      if (/nothing to commit/i.test(ci.out)) {
        ok('没有需要提交的内容（修改均在忽略列表中）');
      } else {
        const c = classify(ci.out);
        return fail('提交失败（git commit）：' + (/tell me who you are/i.test(ci.out) ? 'Git 身份未配置' : ''), ci.out, c.advice);
      }
    } else {
      committed = true;
      ok('已提交: ' + msg);
    }
  } else if (changed.length && DRY_RUN) {
    console.log('  （演练模式跳过提交）');
  }

  /* 4. 与远程比对 */
  step(4, 5, '与远程仓库比对…');
  const head = run(['rev-parse', 'HEAD']).out.trim();
  const ls = run(sshArgs().concat(['ls-remote', REMOTE, BRANCH]), NET_TIMEOUT);
  if (ls.timedOut) return fail('网络异常（连接 GitHub 超时）', '', NET_ADVICE);
  if (ls.code !== 0) {
    const c = classify(ls.out);
    return fail(c.title, ls.out, c.advice);
  }
  const remoteSha = (ls.out.match(/^([0-9a-f]{40})\s+refs\/heads\//m) || [])[1] || '';
  ok('本地  HEAD: ' + head.slice(0, 7));
  ok('远程  main: ' + (remoteSha ? remoteSha.slice(0, 7) : '(空)'));
  if (remoteSha === head) {
    console.log('\n' + LINE);
    console.log('  [完成] 线上已是最新，无需推送。');
    console.log(LINE);
    console.log('  网站: ' + SITE_URL);
    return;
  }
  if (DRY_RUN) {
    console.log('  本地与远程不一致，正式运行时将执行推送。');
    console.log('\n演练结束：未提交、未推送，一切保持原样。');
    return;
  }

  /* 5. 推送（冲突时自动 rebase 一次后重试） */
  step(5, 5, '推送到 GitHub（SSH）…');
  console.log('  （包含大文件时可能需要几分钟，请勿关闭窗口）');
  let push = run(sshArgs().concat(['push', REMOTE, 'HEAD:' + BRANCH]), PUSH_TIMEOUT);
  if (push.timedOut) {
    return fail('推送超时（大文件上传被中断）', '', [
      '直接重新运行本脚本即可，git 会自动接着传。',
      '若反复超时：换更稳定的网络（有线 / 手机热点），避开高峰。',
    ]);
  }
  if (push.code !== 0 && /non-fast-forward|fetch first|rejected/i.test(push.out)) {
    console.log('  检测到远程有新提交，尝试自动同步（pull --rebase）…');
    const pull = run(sshArgs().concat(['pull', '--rebase', REMOTE, BRANCH]), PUSH_TIMEOUT);
    if (pull.code !== 0) {
      run(['rebase', '--abort']);
      return fail('远程冲突，自动同步失败', pull.out, classify('non-fast-forward').advice);
    }
    ok('已合并远程修改，重新推送…');
    push = run(sshArgs().concat(['push', REMOTE, 'HEAD:' + BRANCH]), PUSH_TIMEOUT);
    if (push.timedOut) return fail('推送超时（大文件上传被中断）', '', '重新运行本脚本即可继续。');
  }
  if (push.code !== 0) {
    const c = classify(push.out);
    return fail(c.title, push.out, c.advice);
  }

  /* 核对（教训：回合被打断的大推送会“悄悄中止”，必须 ls-remote 验证） */
  console.log('  核对推送结果…');
  const head2 = run(['rev-parse', 'HEAD']).out.trim();
  const ls2 = run(sshArgs().concat(['ls-remote', REMOTE, BRANCH]), NET_TIMEOUT);
  const remoteSha2 = (ls2.out.match(/^([0-9a-f]{40})\s+refs\/heads\//m) || [])[1] || '';
  if (ls2.code !== 0 || remoteSha2 !== head2) {
    return fail('推送可能被中断（远程未收到最新提交）', push.out + '\n' + ls2.out, [
      '直接重新运行本脚本即可，git 会只补传缺失的部分。',
      '若反复失败，检查网络稳定性（大体积 MP3/MP4 建议稳定 Wi-Fi 或有线）。',
    ]);
  }

  console.log('\n' + LINE);
  console.log('  [成功] 推送完成，网站更新已上线流程启动！');
  console.log(LINE);
  console.log('  提交: ' + head2.slice(0, 7) + (committed ? '（本次新提交）' : ''));
  console.log('  远程: ' + REMOTE + '  分支: ' + BRANCH);
  console.log('  网站: ' + SITE_URL);
  console.log('\n  GitHub Pages 约 1 分钟后自动重建完成，刷新即可看到更新。');
  console.log('  若 2 分钟后线上仍未变化，请运行: node tools/pages-build-admin.js');
}

main();
