# cutout-deco.py — extract line-art from the four owner-provided sheets
# into transparent PNG/WebP recolored to the site's ink (#3b3a38).
# White-bg sheets: alpha = ink darkness. Black-bg sheets: alpha = line light.
import numpy as np
from PIL import Image

INK = (59, 58, 56)  # --ink #3b3a38

def lum(a):
    return (0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2])

def from_white(src, dst, gain=1.25, floor=242, maxw=1400):
    im = Image.open(src).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    l = lum(a)
    # paper is bright; ink is dark. Soft-knee alpha keeps hairlines.
    alpha = np.clip((floor - l) * gain, 0, 255)
    alpha[alpha < 14] = 0
    out = np.zeros((a.shape[0], a.shape[1], 4), dtype=np.uint8)
    out[..., 0], out[..., 1], out[..., 2] = INK
    out[..., 3] = alpha.astype(np.uint8)
    save(out, dst, maxw)

def from_black(src, dst, gain=1.15, ceil=18, maxw=1400):
    im = Image.open(src).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    l = lum(a)
    alpha = np.clip((l - ceil) * gain, 0, 255)
    alpha[alpha < 14] = 0
    out = np.zeros((a.shape[0], a.shape[1], 4), dtype=np.uint8)
    out[..., 0], out[..., 1], out[..., 2] = INK
    out[..., 3] = alpha.astype(np.uint8)
    save(out, dst, maxw)

def save(out, dst, maxw):
    im = Image.fromarray(out, 'RGBA')
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    pad = max(6, im.width // 100)
    canvas = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    canvas.paste(im, (pad, pad))
    im = canvas
    if im.width > maxw:
        im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=90, method=6)
    print(dst, im.size)

A = 'C:/Users/Public/koyome-site/docs/assets/'
from_white('C:/Users/杨坤/.workbuddy/clipboard-images/clipboard-2026-09-24T08-14-58-554Z-84e6f386.jpg',
           A + 'figure_tanya_rifle.webp', gain=1.3)
from_white('C:/Users/杨坤/Pictures/Saved Pictures/D5634254F4C2AC822A19AE94E3B638E9.jpg',
           A + 'deco_angel.webp', gain=2.6, floor=252)   # pencil is faint — push harder
from_black('C:/Users/杨坤/Pictures/Saved Pictures/9DF58805474C1DFC3C2C1A66A0B3876C.jpg',
           A + 'deco_chapel.webp', gain=1.1)
from_black('C:/Users/杨坤/Pictures/Saved Pictures/7A8444B52EB740AE0606965CF7640517.jpg',
           A + 'deco_constellation.webp', gain=1.2)
