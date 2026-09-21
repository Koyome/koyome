# make-avatar-cutout.py — luminance-keyed matting for line art.
# Black ink on white paper: alpha = 255 - luminance, so the paper
# vanishes and the ink sits directly on any background.
# NEVER touches the original; writes docs/assets/avatar_cutout.png.
import os
from PIL import Image, ImageChops

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'assets')
SRC = os.path.join(ROOT, '1789984370788_avatar.png')
DST = os.path.join(ROOT, 'avatar_cutout.png')

im = Image.open(SRC).convert('L')          # grayscale luminance
alpha = ImageChops.invert(im)              # dark ink -> high alpha

# boost: crush near-paper greys to 0, keep the ink
alpha = alpha.point(lambda a: 0 if a < 28 else min(255, int(a * 1.35)))

out = Image.new('RGBA', im.size, (26, 25, 24, 0))   # warm black ink
out.putalpha(alpha)

# trim transparent margins
bbox = alpha.getbbox()
if bbox:
    pad = 12
    l, t, r, b = bbox
    l = max(0, l - pad); t = max(0, t - pad)
    r = min(im.width, r + pad); b = min(im.height, b + pad)
    out = out.crop((l, t, r, b))

# cap the height so the file stays light
out.thumbnail((1000, 1400), Image.LANCZOS)
out.save(DST, 'PNG', optimize=True)
print('cutout:', out.size, os.path.getsize(DST) // 1024, 'KB')
