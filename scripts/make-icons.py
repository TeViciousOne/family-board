"""Builds every app icon from brand/chore-family-logo-sheet.jpg (the Chore Family logo sheet, 2048 x 2048).
Run from the repository root:  python3 scripts/make-icons.py      (needs Pillow and numpy)

  icon-512.png, icon-192.png    app icon (with the name), full square, for the install prompt and Android
  apple-touch-icon.png          180 x 180, iPhone / iPad home screen; iOS also shows it on notifications
  icon-maskable-512.png         brandmark only, centred with room for Android's round / squircle mask
  icon-notify-192.png           brandmark on a rounded tile: the colour picture inside an Android notification
  badge-96.png                  white silhouette on transparent: Android's status bar icon (a coloured or
                                opaque picture there shows as a plain white square)
  favicon-32.png, favicon-64.png, icon.svg   browser tab and the app's own logo
"""
import base64, io, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SHEET = Image.open(os.path.join(ROOT, 'brand', 'chore-family-logo-sheet.jpg')).convert('RGB')
NAVY = (4, 7, 52)                       # the sheet's background behind the brandmark


def out(name):
    return os.path.join(ROOT, name)


def rounded_mask(size, radius):
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return m


def gradient(size, c0, c1):
    """diagonal gradient from the top-left colour to the bottom-right colour"""
    y, x = np.mgrid[0:size, 0:size]
    t = ((x + y) / (2 * (size - 1)))[..., None]
    arr = (np.array(c0) * (1 - t) + np.array(c1) * t).astype(np.uint8)
    return Image.fromarray(arr, 'RGB')


# ---- app icon with the name: the "main app icon" tile, its round corners filled so it is a full square
tile = SHEET.crop((208, 144, 782, 718))                       # 574 x 574
n = tile.size[0]
c0 = tile.getpixel((40, 90)); c1 = tile.getpixel((n - 40, n - 90))
full = gradient(n, c0, c1)
inner = Image.new('L', (n, n), 0)                              # stay inside the tile's own rounded rim
ImageDraw.Draw(inner).rounded_rectangle((12, 12, n - 13, n - 13), radius=64, fill=255)
full.paste(tile, (0, 0), inner.filter(ImageFilter.GaussianBlur(7)))
for size, name in ((512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png')):
    full.resize((size, size), Image.LANCZOS).save(out(name), optimize=True)

# ---- brandmark (house, brush, spray, swoosh) on the sheet's navy
mark_raw = SHEET.crop((233, 869, 752, 1355))                  # stops above the black & white panel below it
mark = Image.new('RGB', (519, 519), NAVY); mark.paste(mark_raw, (0, (519 - mark_raw.size[1]) // 2))


def mark_on(size, scale, rounded=None):
    can = Image.new('RGB', (size, size), NAVY)
    m = mark.resize((int(size * scale), int(size * scale)), Image.LANCZOS)
    can.paste(m, ((size - m.size[0]) // 2, (size - m.size[1]) // 2))
    if rounded:
        rgba = can.convert('RGBA')
        rgba.putalpha(rounded_mask(size, int(size * rounded)))
        return rgba
    return can


mark_on(512, 0.78).save(out('icon-maskable-512.png'), optimize=True)      # safe zone is the middle 80 %
mark_on(192, 0.96, rounded=0.22).save(out('icon-notify-192.png'), optimize=True)
mark_on(64, 1.0, rounded=0.22).save(out('favicon-64.png'), optimize=True)
mark_on(32, 1.0, rounded=0.22).save(out('favicon-32.png'), optimize=True)

# icon.svg: the brandmark tile as a picture inside an SVG (keeps every existing link to icon.svg working)
buf = io.BytesIO(); mark_on(128, 0.98, rounded=0.22).save(buf, 'PNG', optimize=True)
b64 = base64.b64encode(buf.getvalue()).decode()
with open(out('icon.svg'), 'w') as f:
    f.write('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 128 128" width="128" height="128">'
            '<title>Chore Family</title><image width="128" height="128" href="data:image/png;base64,' + b64 + '" xlink:href="data:image/png;base64,' + b64 + '"/></svg>\n')

# ---- Android status bar badge: white artwork, transparent everywhere else (from the black & white version)
bw = SHEET.crop((254, 1490, 710, 1846)).convert('L')         # the mark without the word "FAMILY"
w, h = bw.size; side = max(w, h)
sq = Image.new('L', (side, side), 0); sq.paste(bw, ((side - w) // 2, (side - h) // 2))
a = np.array(sq).astype(float)
a = np.clip((a - 60) * 255.0 / (230 - 60), 0, 255).astype(np.uint8)      # black -> clear, white -> solid
alpha = Image.fromarray(a).resize((84, 84), Image.LANCZOS)
badge = Image.new('RGBA', (96, 96), (255, 255, 255, 0))
white = Image.new('RGBA', (84, 84), (255, 255, 255, 255)); white.putalpha(alpha)
badge.paste(white, (6, 6), white)
badge.save(out('badge-96.png'), optimize=True)
print('icons written')
