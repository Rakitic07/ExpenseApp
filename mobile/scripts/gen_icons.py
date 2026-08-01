#!/usr/bin/env python3
"""Generate Android launcher icons from assets/icon.png.

- Legacy square + round bitmaps (API < 26).
- Adaptive icon (API 26+): a dark background colour + a foreground where the
  full colourful art is scaled INTO the safe zone (transparent margins) so the
  system mask never crops the chart — the icon is shown "as is".
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(ROOT, '..', 'assets', 'icon.png')
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')

LEGACY = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
ADAPTIVE = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
# Fraction of the 108dp layer the art occupies (safe zone ≈ 66%).
SAFE = 0.70

src = Image.open(SRC).convert('RGBA')


def rounded_square(img, radius_frac=0.22):
    w, h = img.size
    r = int(min(w, h) * radius_frac)
    mask = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, w, h], radius=r, fill=255)
    out = img.copy()
    out.putalpha(mask)
    return out


def circle(img):
    w, h = img.size
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, w, h], fill=255)
    out = img.copy()
    out.putalpha(mask)
    return out


for dens, size in LEGACY.items():
    d = os.path.join(RES, f'mipmap-{dens}')
    os.makedirs(d, exist_ok=True)
    base = src.resize((size, size), Image.LANCZOS)
    rounded_square(base).save(os.path.join(d, 'ic_launcher.png'))
    circle(base).save(os.path.join(d, 'ic_launcher_round.png'))

for dens, size in ADAPTIVE.items():
    d = os.path.join(RES, f'mipmap-{dens}')
    os.makedirs(d, exist_ok=True)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    inner = int(size * SAFE)
    art = rounded_square(src.resize((inner, inner), Image.LANCZOS))
    off = (size - inner) // 2
    canvas.paste(art, (off, off), art)
    canvas.save(os.path.join(d, 'ic_launcher_foreground.png'))

# Adaptive XML (background colour + foreground art)
anydpi = os.path.join(RES, 'mipmap-anydpi-v26')
os.makedirs(anydpi, exist_ok=True)
xml = (
    '<?xml version="1.0" encoding="utf-8"?>\n'
    '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
    '    <background android:drawable="@color/ic_launcher_background" />\n'
    '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n'
    '</adaptive-icon>\n'
)
with open(os.path.join(anydpi, 'ic_launcher.xml'), 'w') as f:
    f.write(xml)
with open(os.path.join(anydpi, 'ic_launcher_round.xml'), 'w') as f:
    f.write(xml)

# Background colour resource
values = os.path.join(RES, 'values')
os.makedirs(values, exist_ok=True)
colors_path = os.path.join(values, 'colors.xml')
color_line = '    <color name="ic_launcher_background">#07070F</color>\n'
if os.path.exists(colors_path):
    with open(colors_path) as f:
        content = f.read()
    if 'ic_launcher_background' not in content:
        content = content.replace('</resources>', color_line + '</resources>')
        with open(colors_path, 'w') as f:
            f.write(content)
else:
    with open(colors_path, 'w') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n' + color_line + '</resources>\n')

print('Icons generated into', RES)
