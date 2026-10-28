#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow>=10", "fonttools>=4"]
# ///
#
# Render the loop panel's preview to a PNG, colours, dim, bold and strikethrough as the terminal
# draws them: the screen `tmux capture-pane -e` reads from the cantrips-mod session, cropped to the
# pane right of the chat's divider. uv fetches Pillow and fontTools on the first run; the font is
# what fontconfig matches for Fira Code, and for a glyph that font lacks, the font fontconfig finds
# holding it.
#
# usage: mod-shot.py <out.png> [--target <tmux-target>] [--full] [--scale <n>]

import argparse
import functools
import re
import subprocess
import unicodedata

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

DEFAULT_FG = (216, 222, 233)
DEFAULT_BG = (30, 30, 30)
BASE16 = [
  (0, 0, 0), (205, 49, 49), (13, 188, 121), (229, 229, 16),
  (36, 114, 200), (188, 63, 188), (17, 168, 205), (229, 229, 229),
  (102, 102, 102), (241, 76, 76), (35, 209, 139), (245, 245, 67),
  (59, 142, 234), (214, 112, 214), (41, 184, 219), (255, 255, 255),
]


def xterm256(n):
  if n < 16:
    return BASE16[n]
  if n < 232:
    n -= 16
    steps = [0, 95, 135, 175, 215, 255]
    return (steps[n // 36], steps[n // 6 % 6], steps[n % 6])
  v = 8 + (n - 232) * 10
  return (v, v, v)


def parse(line):
  """A line's characters as (char, fg, bg, bold, dim, strike), from its SGR sequences."""
  fg = bg = None
  bold = dim = strike = False
  cells = []
  for token in re.split(r'(\x1b\[[0-9;:]*m)', line):
    if not token.startswith('\x1b['):
      cells += [(char, fg, bg, bold, dim, strike) for char in token]
      continue
    codes = [int(c) if c else 0 for c in re.split('[;:]', token[2:-1])]
    i = 0
    while i < len(codes):
      c = codes[i]
      if c == 0:
        fg = bg = None
        bold = dim = strike = False
      elif c == 1:
        bold = True
      elif c == 2:
        dim = True
      elif c == 22:
        bold = dim = False
      elif c == 9:
        strike = True
      elif c == 29:
        strike = False
      elif c in (38, 48):
        if codes[i + 1] == 5:
          color, i = xterm256(codes[i + 2]), i + 2
        else:
          color, i = tuple(codes[i + 2:i + 5]), i + 4
        fg, bg = (color, bg) if c == 38 else (fg, color)
      elif c == 39:
        fg = None
      elif c == 49:
        bg = None
      elif 30 <= c <= 37 or 90 <= c <= 97:
        fg = BASE16[c - 30 if c < 90 else c - 82]
      elif 40 <= c <= 47 or 100 <= c <= 107:
        bg = BASE16[c - 40 if c < 100 else c - 92]
      i += 1
  return cells


def width(char):
  return 2 if unicodedata.east_asian_width(char) in 'WF' else 1


@functools.cache
def font_file(pattern):
  """The file fontconfig matches for the pattern, and the face's index in it (a collection's)."""
  file, index = subprocess.run(
    ['fc-match', '-f', '%{file}\n%{index}', pattern], capture_output=True, text=True, check=True
  ).stdout.split('\n')
  return file, int(index)


def main():
  parser = argparse.ArgumentParser(description='Render the loop panel preview to a PNG.')
  parser.add_argument('out')
  parser.add_argument('--target', default='cantrips-mod')
  parser.add_argument('--full', action='store_true', help='the whole screen, chat included')
  parser.add_argument('--scale', type=int, default=2)
  args = parser.parse_args()

  screen = subprocess.run(
    ['tmux', 'capture-pane', '-p', '-e', '-t', args.target],
    capture_output=True, text=True, check=True,
  ).stdout
  # The cells on a grid, a wide character taking two.
  grid = []
  for line in screen.split('\n'):
    row = []
    for cell in parse(line):
      row += [cell] if width(cell[0]) == 1 else [cell, None]
    grid.append(row)
  right = max(map(len, grid))
  # tmux trims a row's trailing blanks: carry its last background to the edge.
  for row in grid:
    last = next((cell for cell in reversed(row) if cell is not None), None)
    if last is not None and last[2] is not None:
      row += [(' ', None, last[2], False, False, False)] * (right - len(row))

  left = 0
  if not args.full:
    # The pane is the rows the divider runs down, right of the column most rows draw it in.
    columns = [
      x for row in grid for x, cell in enumerate(row) if cell is not None and cell[0] == '│'
    ]
    if columns:
      divider = max(set(columns), key=columns.count)
      grid = [row for row in grid if len(row) > divider and (row[divider] or ' ')[0] == '│']
      left = divider + 1
  grid = [row[left:right] for row in grid]
  while grid and all(cell is None or cell[0] == ' ' for cell in grid[-1]):
    grid.pop()

  size = 14 * args.scale
  loaded = {}

  def load(pattern):
    face = font_file(pattern)
    if face not in loaded:
      file, index = face
      try:
        font = ImageFont.truetype(file, size, index=index)
        loaded[face] = (font, TTFont(file, fontNumber=index).getBestCmap())
      except OSError:
        # A bitmap font, such as a colour emoji's, that renders at its own sizes only.
        loaded[face] = None
    return loaded[face]

  def font_for(char, bold):
    # Fira Code where it has the glyph, else the font fontconfig finds holding it.
    weight = 'bold' if bold else 'regular'
    main, glyphs = load(f'Fira Code:{weight}')
    if ord(char) in glyphs:
      return main
    back = load(f'DejaVu Sans Mono:{weight}:charset={ord(char):x}')
    return back[0] if back is not None else load(f'DejaVu Sans Mono:{weight}')[0]

  cw = round(load('Fira Code:regular')[0].getlength('M'))
  ch, pad = round(size * 1.3), 8 * args.scale
  image = Image.new('RGB', (cw * (right - left) + 2 * pad, ch * len(grid) + 2 * pad), DEFAULT_BG)
  draw = ImageDraw.Draw(image)
  for y, row in enumerate(grid):
    for x, cell in enumerate(row):
      if cell is None:
        continue
      char, fg, bg, bold, dim, strike = cell
      fg = fg or DEFAULT_FG
      if dim:
        fg = tuple((a + b) // 2 for a, b in zip(fg, bg or DEFAULT_BG))
      px, py, w = pad + x * cw, pad + y * ch, cw * width(char)
      if bg:
        draw.rectangle([px, py, px + w - 1, py + ch - 1], fill=bg)
      draw.text((px, py + (ch - size) // 2), char, font=font_for(char, bold), fill=fg)
      if strike:
        draw.line([px, py + ch // 2, px + w, py + ch // 2], fill=fg, width=args.scale)
  image.save(args.out)
  print(args.out)


main()
