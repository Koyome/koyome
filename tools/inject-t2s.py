#!/usr/bin/env python3
"""inject-t2s.py — splice the runtime 繁→简 section into docs/js/i18n.js
and register the zhcn language. Idempotent: refuses to run twice."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
I18N = os.path.join(HERE, '..', 'docs', 'js', 'i18n.js')

T2S_SECTION_HEAD = "  /* ---------------- runtime 繁→简 (content fields) ----------------"


def main() -> int:
    src = open(I18N, encoding='utf-8').read()

    data = open(os.path.join(HERE, '_t2s_data.txt'), encoding='utf-8').read().rstrip() + '\n'
    # re-indent the generated consts by two spaces
    data = '\n'.join('  ' + ln if ln.strip() else ln for ln in data.splitlines()) + '\n'

    section = (
        T2S_SECTION_HEAD + "\n"
        "     data.js loc() runs every *Zh string through t2s() when the site is in\n"
        "     简体中文, so user content never needs a third copy. Maximal forward\n"
        "     matching (same algorithm as zhconv); tables from tools/build-zhcn.py. */\n"
        + data +
        "\n"
        "  const T2S_MAP = (() => {\n"
        "    const m = Object.create(null);\n"
        "    /* Array.from iterates CODE POINTS — several CJK ext chars in the\n"
        "       packed table are astral (2 UTF-16 units); naive i+=2 indexing\n"
        "       would desync every pair after the first astral char */\n"
        "    const a = Array.from(T2S_CHARS);\n"
        "    for (let i = 0; i < a.length; i += 2) m[a[i]] = a[i + 1];\n"
        "    return m;\n"
        "  })();\n"
        "\n"
        "  function t2s(s) {\n"
        "    if (!s) return s;\n"
        "    let out = '';\n"
        "    const N = s.length;\n"
        "    let pos = 0;\n"
        "    while (pos < N) {\n"
        "      let hit = null;\n"
        "      const max = Math.min(T2S_MAX, N - pos);\n"
        "      for (let len = max; len >= 2; len--) {\n"
        "        const frag = s.substr(pos, len);\n"
        "        if (T2S_PHRASES[frag] !== undefined) { hit = T2S_PHRASES[frag]; pos += len; break; }\n"
        "      }\n"
        "      if (hit === null) {\n"
        "        const ch = String.fromCodePoint(s.codePointAt(pos));\n"
        "        hit = T2S_MAP[ch] !== undefined ? T2S_MAP[ch] : ch;\n"
        "        pos += ch.length;\n"
        "      }\n"
        "      out += hit;\n"
        "    }\n"
        "    return out;\n"
        "  }\n"
        "\n"
    )

    # idempotent: if the section already exists, replace it wholesale
    anchor = '  let lang = (() => {'
    if T2S_SECTION_HEAD in src:
        head_i = src.index(T2S_SECTION_HEAD)
        anchor_i = src.index(anchor, head_i)
        src = src[:head_i] + section + src[anchor_i:]
    else:
        replacements_head = [
            ('i18n.js — Language system: English (default) + 繁體中文',
             'i18n.js — Language system: English (default) + 繁體中文 + 简体中文'),
            (anchor, section + anchor),
        ]
        for old, new in replacements_head:
            if old not in src:
                print('ANCHOR NOT FOUND:', old[:60])
                return 1
            src = src.replace(old, new, 1)

    replacements = [
        ("return saved === 'zh' ? 'zh' : 'en'; /* default: English */",
         "return ['en', 'zh', 'zhcn'].includes(saved) ? saved : 'en'; /* default: English */"),
        ("    if (l !== 'en' && l !== 'zh') return;",
         "    if (l !== 'en' && l !== 'zh' && l !== 'zhcn') return;"),
        ('  global.I18N = { t, applyStatic, bind, get lang() { return lang; } };',
         '  global.I18N = {\n'
         '    t, applyStatic, bind, t2s,\n'
         '    get lang() { return lang; },\n'
         '    /* true for BOTH Chinese modes — edit-in-place always writes the *Zh\n'
         '       field, the single Chinese source of truth (简体中文 is derived) */\n'
         "    get isZh() { return lang === 'zh' || lang === 'zhcn'; },\n"
         '  };'),
    ]
    for old, new in replacements:
        if old in src:
            src = src.replace(old, new, 1)
        elif new.split('\n')[0][:40] in src:
            pass  # already applied
        else:
            print('ANCHOR NOT FOUND:', old[:60])
            return 1

    open(I18N, 'w', encoding='utf-8', newline='\n').write(src)
    print('injected ok, i18n.js now', len(src), 'chars')
    return 0


if __name__ == '__main__':
    sys.exit(main())
