"""Build docs/.vitepress/theme/fonts/rich-powerline.woff2.

    uv run --with fonttools --with brotli scripts/powerline-font.py SymbolsNerdFontMono-Regular.ttf

The source is the Mono face of NerdFontsSymbolsOnly.zip from a Nerd Fonts
release (v3.5.1 when this was written). The output keeps only the Powerline and
Powerline Extra glyphs (U+E0A0-U+E0D7, both MIT; the licence is fonts/LICENSE,
written into the font's name table so the notice travels with the file the site
serves)
and fits each one to the cell of Menlo and DejaVu Sans Mono (one design, so one
set of metrics), the face a reader without JetBrains Mono gets in Chrome on
macOS and on Linux. Nerd Fonts draws these 1em wide and 1em tall. At 1em wide
each arrow would push the rest of its row 0.4em right, and at 1em tall a cap
would leave the top of its segment's background showing, because a span's
background is the height of the row's own font, not of this one.

custom.css names this face first in the code font stack with a matching
unicode-range, so a browser fetches it only for a page that draws one of these
glyphs, and draws every other character in the reader's own code font.
"""

import sys
from pathlib import Path

from fontTools import subset
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

POWERLINE = range(0xE0A0, 0xE0D8)
# Menlo's hhea metrics, in its own 2048 units per em.
CELL_WIDTH, CELL_ASCENT, CELL_DESCENT = 1233 / 2048, 1901 / 2048, 483 / 2048
OUT = Path(__file__).resolve().parent.parent / "docs/.vitepress/theme/fonts/rich-powerline.woff2"

font = TTFont(sys.argv[1])
options = subset.Options()
options.flavor = "woff2"
options.name_IDs = ["*"]
options.notdef_outline = True
subsetter = subset.Subsetter(options)
subsetter.populate(unicodes=POWERLINE)
subsetter.subset(font)

upm = font["head"].unitsPerEm
cell, ascent, descent = (round(upm * m) for m in (CELL_WIDTH, CELL_ASCENT, CELL_DESCENT))
# Nerd Fonts' own glyph box, which the Mono face declares as its line metrics.
top, bottom = font["hhea"].ascent, font["hhea"].descent
yscale = (ascent + descent) / (top - bottom)
yshift = ascent - top * yscale
glyf, hmtx = font["glyf"], font["hmtx"]
for name in font.getGlyphOrder():
    advance, _ = hmtx[name]
    xscale = cell / advance
    recording = DecomposingRecordingPen(font.getGlyphSet())
    font.getGlyphSet()[name].draw(recording)
    pen = TTGlyphPen(None)
    recording.replay(TransformPen(pen, (xscale, 0, 0, yscale, 0, yshift)))
    glyph = pen.glyph()
    glyf[name] = glyph
    glyph.recalcBounds(glyf)
    hmtx[name] = (cell, getattr(glyph, "xMin", 0))

font["hhea"].advanceWidthMax = cell
font["hhea"].ascent, font["hhea"].descent = ascent, -descent
os2 = font["OS/2"]
os2.sTypoAscender, os2.sTypoDescender, os2.usWinAscent, os2.usWinDescent = ascent, -descent, ascent, descent
os2.xAvgCharWidth = cell
font["name"].setName((OUT.parent / "LICENSE").read_text(), 13, 3, 1, 0x409)
font["name"].setName("https://github.com/ryanoasis/nerd-fonts", 14, 3, 1, 0x409)
font.save(OUT)
print(f"{OUT}: {OUT.stat().st_size} bytes")
