/* make-kstage-preview.js — 把 docs/components 的 kstage.css / kstage.js 内联进
   tools/kstage-preview.html，生成一个双击就能看的单文件预览（默认写到桌面）。
   用法：node tools/make-kstage-preview.js [输出路径]                        */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(__dirname, 'kstage-preview.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'docs', 'components', 'kstage.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'docs', 'components', 'kstage.js'), 'utf8');

if (js.indexOf('</script') !== -1) throw new Error('kstage.js 里出现了 </script>，内联会断');

/* 单文件版不需要兜底图（JS 一定在），顺手摘掉，免得 file:// 下出现裂图 */
html = html.replace(/\s*data-fallback="[^"]*"/g, '');
html = html.replace('<link rel="stylesheet" href="../docs/components/kstage.css">',
  function () { return '<style>\n' + css + '\n</style>'; });
html = html.replace('<script src="../docs/components/kstage.js"></script>',
  function () { return '<script>\n' + js + '\n</script>'; });

if (html.indexOf('../docs/components/') !== -1) throw new Error('还有未内联的引用，检查占位是否被改过');

const out = process.argv[2] || 'C:/Users/杨坤/Desktop/kstage-preview.html';
fs.writeFileSync(out, html);
console.log('written ' + out + ' (' + html.length + ' bytes)');
