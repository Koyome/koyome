#!/usr/bin/env python3
"""gen-t2s-cases.py — build authoritative test cases for the JS t2s():
every sample string converted by Python zhconv (locale zh-cn). The JS port
must reproduce these byte-for-byte."""
import json
import os
import sys

sys.stdout = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '_gen.log'), 'w', encoding='utf-8')

import zhconv  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))

SAMPLES = [
    '歡迎——就把這裡當成自己的家。',
    '我幹什麼不干你事。',
    '凌晨的電台沙沙作響，像有人在很遠的地方輕輕敲門。',
    '值得重讀的文字、值得多看兩眼的畫面，還有不想忘記的影片，我都放在這裡。',
    'Koyome（koyome.me）是我在網路上的一小塊地：',
    '不追什麼潮流——只是收集訊號。',
    '這是一則範例文字。到管理頁把它換成你自己的話吧。',
    '喜歡的動漫，和那些留在我心裡的角色。',
    'English stays 100% untouched ABC 123 !',
    '髮型與頭髮，乾杯與餅乾，後面與皇后',
    '一張幾何線稿。',
    '這個小站是為了什麼。',
    '示範影片內容如何呈現與播放。',
    '留下值得留下的字\n· 存放值得回頭看的圖\n· 收藏值得再看一次的影像',
    '寫在深夜的幾行字。',
    '我想每個人心裡都有一座燈塔——大部分日子是暗的，只在某些夜晚亮起來，給剛好路過的人看。',
    '「引號」與『書名號』的轉換',
    '軟體、網路、記憶體、資料庫、程式設計',
]

cases = [[s, zhconv.convert(s, 'zh-cn')] for s in SAMPLES]
with open(os.path.join(HERE, '_t2s_cases.json'), 'w', encoding='utf-8') as f:
    json.dump(cases, f, ensure_ascii=False, indent=1)
print('wrote', len(cases), 'cases')
