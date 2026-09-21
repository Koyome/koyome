# make-opt-images.py — create optimized derivatives of heavy assets.
# NEVER touches the originals (hard rule); writes new files into
# docs/assets/opt/ and prints a JSON map old-src -> new-src.
import json
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'assets')
OUT = os.path.join(ROOT, 'opt')
os.makedirs(OUT, exist_ok=True)

# (source filename, max long edge, quality)
TARGETS = [
    ('1789984370788_avatar.png', 900, 84),   # homepage portrait
    ('1789827413545_C22FA9D2AC86DC60465FB447FBE77D74.png', 1600, 82),
    ('1789827439977_77B16F1FE3D306E9A9A529EC595A1C9F.png', 1600, 82),
    ('1789827463648_7948611B08EF56A717495E7FF2E3FEAA.png', 1600, 82),
    ('1789845981608_A6FAE8EEE363B42BCA57F63EAC694A6F.png', 1600, 82),
    ('1789845987418_70F78868918BDE2F04F794E9D55A562E.png', 1600, 82),
    ('1789846000022_B02D028EF710618756716BD55EF99D45.png', 1600, 82),
    ('1789846010722_807A125E79E15FE0162B22FC48C7AC4C.png', 1600, 82),
    ('1789846017533_BDF0294A58CC3F78A62AA38255BDD0E8.png', 1600, 82),
]

remap = {}
for name, edge, q in TARGETS:
    src = os.path.join(ROOT, name)
    if not os.path.exists(src):
        print('MISSING', name)
        continue
    im = Image.open(src)
    if im.mode in ('RGBA', 'LA', 'P'):
        bg = Image.new('RGB', im.size, (235, 233, 230))
        im2 = im.convert('RGBA') if im.mode == 'P' else im
        bg.paste(im2, mask=im2.split()[-1])
        im = bg
    else:
        im = im.convert('RGB')
    im.thumbnail((edge, edge), Image.LANCZOS)
    out_name = os.path.splitext(name)[0] + '.jpg'
    if name == '1789984370788_avatar.png':
        out_name = 'avatar_opt.jpg'
    dst = os.path.join(OUT, out_name)
    im.save(dst, 'JPEG', quality=q, optimize=True, progressive=True)
    old_kb = os.path.getsize(src) // 1024
    new_kb = os.path.getsize(dst) // 1024
    remap['assets/' + name] = 'assets/opt/' + out_name
    print(f'{old_kb:>7}KB -> {new_kb:>5}KB  {out_name}')

with open(os.path.join(OUT, 'remap.json'), 'w', encoding='utf-8') as f:
    json.dump(remap, f, ensure_ascii=False, indent=2)
print('OK', len(remap), 'derivatives')
