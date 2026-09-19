"""Build a clean avatar from the source portrait.

The source (1708x1920) is a line drawing whose right-hand side carries a
three-line caption. We locate the caption glyphs as *small, compact*
connected components inside that band and erase them, leaving the
character (including the flowing hair) fully intact. Then we tighten the
composition and down-scale for the web.
"""
from PIL import Image

SRC = r"C:\Users\杨坤\.workbuddy\clipboard-images\clipboard-2026-09-19T12-04-03-181Z-733cf8c2.jpg"
DST = r"C:\Users\杨坤\WorkBuddy\2026-09-19-19-30-28\koyome\public\assets\avatar.jpg"

img = Image.open(SRC).convert("RGB")
W, H = img.size
print("source:", W, "x", H)

# ---- 1. find caption glyphs in the right-hand band -------------------
gray = img.convert("L")
gp = gray.load()

X0, Y0, X1, Y1 = 1040, 520, W, 1080
rw, rh = X1 - X0, Y1 - Y0

ink = bytearray(rw * rh)
for y in range(Y0, Y1):
    base = (y - Y0) * rw
    for x in range(X0, X1):
        if gp[x, y] < 205:
            ink[base + x - X0] = 1

seen = bytearray(rw * rh)
boxes = []
for sy in range(rh):
    for sx in range(rw):
        i0 = sy * rw + sx
        if not ink[i0] or seen[i0]:
            continue
        stack = [i0]
        seen[i0] = 1
        n = 0
        minx = maxx = sx
        miny = maxy = sy
        while stack:
            i = stack.pop()
            n += 1
            cy, cx = divmod(i, rw)
            if cx < minx: minx = cx
            if cx > maxx: maxx = cx
            if cy < miny: miny = cy
            if cy > maxy: maxy = cy
            for dy in (-1, 0, 1):
                ny = cy + dy
                if ny < 0 or ny >= rh: continue
                for dx in (-1, 0, 1):
                    nx = cx + dx
                    if nx < 0 or nx >= rw: continue
                    j = ny * rw + nx
                    if ink[j] and not seen[j]:
                        seen[j] = 1
                        stack.append(j)
        boxes.append((minx, miny, maxx, maxy, n))

# The caption sits in a well-defined band: three lines of type, entirely to
# the right of the hair (x >= 1140) and between y 618 and 872. Restricting to
# that band keeps every hair stroke intact.
CAP_X, CAP_Y0, CAP_Y1 = 1140, 618, 872
glyphs = [b for b in boxes
          if (b[2] - b[0]) <= 170 and (b[3] - b[1]) <= 140 and b[4] >= 25
          and X0 + b[0] >= CAP_X and Y0 + b[1] >= CAP_Y0 and Y0 + b[3] <= CAP_Y1]
print("components:", len(boxes), "| erased as caption:", len(glyphs))
for b in sorted(glyphs, key=lambda b: (b[1], b[0])):
    print("   box x", X0 + b[0], "-", X0 + b[2], " y", Y0 + b[1], "-", Y0 + b[3], " px", b[4])

# ---- 2. erase them (pure white page -> invisible) -------------------
draw_px = img.load()
for (minx, miny, maxx, maxy, _) in glyphs:
    for y in range(Y0 + miny - 2, Y0 + maxy + 3):
        for x in range(X0 + minx - 2, X0 + maxx + 3):
            if 0 <= x < W and 0 <= y < H:
                draw_px[x, y] = (255, 255, 255)
img.save(r"C:\Users\杨坤\WorkBuddy\2026-09-19-19-30-28\koyome\tools\_clean.png")

# ---- 3. tighten + down-scale ----------------------------------------
img = img.crop((0, 0, 1345, H))
target_h = 1200
target_w = round(img.width * target_h / H)
img = img.resize((target_w, target_h), Image.LANCZOS)
img.save(DST, "JPEG", quality=90, optimize=True, progressive=True)
print("avatar:", img.size, "->", DST)
