#!/usr/bin/env python3
"""make-dark-cutout.py — bake the dark-mode variant of a transparent cutout.

Why this exists (R21): iOS WebKit does not reliably repaint an element that
has ALL of — an ongoing transform animation (compositor layer),
mix-blend-mode, AND a filter that changes when [data-theme] flips on an
ancestor. The stale layer kept the dark-mode invert(0.92) baked in
(blue residue) and re-rasterized at the wrong scale (blur).

Fix: no runtime invert() at all. Dark mode swaps the <img> src to a
pre-baked variant whose RGB is exactly what invert(0.92) would have
produced, alpha untouched. Visual result identical, zero compositor magic.

CSS filter invert(0.92) per channel:  out = c*(1-k) + (255-c)*k, k=0.92
=> out = 234.6 - 0.84*c
"""
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'assets')

PAIRS = [
    ('avatar_cutout.webp', 'avatar_cutout_dark.webp'),
    ('figure_tanya_rifle.webp', 'figure_tanya_rifle_dark.webp'),
    ('deco_chapel.webp', 'deco_chapel_dark.webp'),
    ('deco_constellation.webp', 'deco_constellation_dark.webp'),
]


def bake(src_path: str, dst_path: str) -> None:
    img = Image.open(src_path).convert('RGBA')
    a = np.asarray(img).astype(np.float64)
    rgb = a[..., :3]
    alpha = a[..., 3]
    out_rgb = np.clip(np.round(234.6 - 0.84 * rgb), 0, 255).astype(np.uint8)
    out = np.dstack([out_rgb, alpha.astype(np.uint8)])
    Image.fromarray(out, 'RGBA').save(dst_path, 'WEBP', quality=90, method=6)

    opaque = alpha > 128
    if opaque.any():
        src_mean = rgb[opaque].mean(axis=0).round(1)
        dst_mean = out_rgb[opaque].mean(axis=0).round(1)
    else:
        src_mean = dst_mean = [0, 0, 0]
    print(f'{os.path.basename(src_path)}: mean RGB {src_mean} -> {dst_mean}, '
          f'{img.size[0]}x{img.size[1]}, {os.path.getsize(dst_path)//1024} KB')


def main() -> int:
    ok = True
    for src, dst in PAIRS:
        sp, dp = os.path.join(ROOT, src), os.path.join(ROOT, dst)
        if not os.path.exists(sp):
            print(f'MISSING SOURCE: {sp}', file=sys.stderr)
            ok = False
            continue
        bake(sp, dp)
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
