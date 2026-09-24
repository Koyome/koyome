#!/usr/bin/env python3
"""build-zhcn.py — generate the Simplified-Chinese assets for Koyome.

Outputs (consumed by hand via the Edit tool, nothing is overwritten):
  tools/_zhcn_block.txt — the `zhcn: { ... }` DICT block for i18n.js,
                          machine-converted from the zh block with zhconv
                          (locale zh-cn = mainland terminology) plus a small
                          curated override table for consistent wording.
  tools/_t2s_data.txt   — runtime 繁→简 data for content fields (data.js
                          loc()): packed char map + irregular phrase map +
                          max phrase length, as JS literals.
"""
import io
import json
import os
import re
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import zhconv  # noqa: E402
from zhconv.zhconv import getdict  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
I18N = os.path.join(HERE, '..', 'docs', 'js', 'i18n.js')

# curated mainland-wording overrides, applied AFTER zhconv (order matters)
OVERRIDES = [
    ('儲存', '保存'), ('储存', '保存'),
    ('送出', '发送'),
    ('自訂', '自定义'), ('自定', '自定义'), ('自订', '自定义'),
    ('匯入', '导入'), ('汇入', '导入'),
    ('檔名', '文件名'), ('档名', '文件名'),
    ('貼上', '粘贴'), ('贴上', '粘贴'),
    ('執行', '运行'), ('执行', '运行'),
    ('影片', '视频'),
    ('音訊', '音频'), ('音讯', '音频'),
    ('檔案', '文件'), ('档案', '文件'),
    ('網路', '网络'), ('网路', '网络'),
    ('註腳', '注脚'), ('注腳', '注脚'),
]

# corner brackets are Traditional-typography; mainland uses curly quotes.
# applied to BOTH the static block and the runtime char map.
PUNCT = {'「': '“', '」': '”', '『': '‘', '』': '’'}


def polish(s: str) -> str:
    for old, new in OVERRIDES:
        s = s.replace(old, new)
    for old, new in PUNCT.items():
        s = s.replace(old, new)
    return s


def js_str(s: str) -> str:
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"


def main() -> int:
    src = open(I18N, encoding='utf-8').read()

    # ---- 1. extract the zh DICT block -------------------------------------
    # (ends at the FIRST 4-indent closing brace after `zh: {` — do NOT anchor
    # on `\n    },\n  };` because the generated zhcn block also ends that way)
    start = src.index('\n    zh: {\n')
    tail = src.index('\n    },\n', start)
    block = src[start:tail]
    entries = re.findall(r"(\w+):\s*'((?:[^'\\]|\\.)*)'", block)
    if len(entries) < 100:
        print(f'ERROR: only {len(entries)} entries parsed from zh block')
        return 1

    # ---- 2. convert every value --------------------------------------------
    lines = []
    for key, val in entries:
        if key == '_html':
            out = 'zh-Hans'
        else:
            out = polish(zhconv.convert(val, 'zh-cn'))
        lines.append(f'      {key}: {js_str(out)},')
    zhcn_block = '    zhcn: {\n' + '\n'.join(lines) + '\n    },'
    with open(os.path.join(HERE, '_zhcn_block.txt'), 'w', encoding='utf-8') as f:
        f.write(zhcn_block + '\n')
    print(f'zhcn block: {len(entries)} entries')

    # ---- 3. runtime t2s data ------------------------------------------------
    full = getdict('zh-cn')  # zh2Hans + zh2CN merged
    char_map = {}
    spill = {}  # 1-char keys whose value is NOT a single code point
    for k, v in full.items():
        if len(k) == 1 and k != v:
            if len(v) == 1:
                char_map[k] = v
            else:
                spill[k] = v
    for k, v in PUNCT.items():
        char_map[k] = v
    # NOTE: packed as k+v pairs — several CJK ext chars are ASTRAL (2 UTF-16
    # code units), so the JS side MUST iterate code points (Array.from),
    # never index the string by code unit.

    def charwise(s: str) -> str:
        return ''.join(char_map.get(c, c) for c in s)

    phrases = {}
    phrases.update(spill)
    for k, v in full.items():
        if 2 <= len(k) <= 8 and v != charwise(k):
            phrases[k] = v  # keep dict wording for content (no UI polish)
    max_len = max((len(k) for k in phrases), default=1)

    packed_chars = ''.join(k + v for k, v in sorted(char_map.items()))
    payload = {
        'chars_packed_len': len(packed_chars),
        'char_entries': len(char_map),
        'phrase_entries': len(phrases),
        'max_phrase_len': max_len,
        'approx_js_kb': round((len(packed_chars) + len(json.dumps(phrases, ensure_ascii=False))) / 1024, 1),
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))

    with open(os.path.join(HERE, '_t2s_data.txt'), 'w', encoding='utf-8') as f:
        f.write('const T2S_CHARS = ' + js_str(packed_chars) + ';\n\n')
        f.write('const T2S_PHRASES = ' + json.dumps(phrases, ensure_ascii=False,
                separators=(',', ':')) + ';\n\n')
        f.write(f'const T2S_MAX = {max_len};\n')

    # ---- 4. sanity samples ---------------------------------------------------
    samples = ['歡迎——就把這裡當成自己的家。',
               '儲存失敗，請重試。',
               '我幹什麼不干你事。',
               '點擊最上面的照片——它會沉到照片疊底層',
               '在這裡插入文字、圖片或影片——提交後立即出現在目錄頁。']
    for s in samples:
        print(polish(zhconv.convert(s, 'zh-cn')))
    return 0


if __name__ == '__main__':
    sys.exit(main())
