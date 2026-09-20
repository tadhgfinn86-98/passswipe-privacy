#!/usr/bin/env python3
"""Renders Sip's app icon: a five-bar tally gate, off-white on near-black.

Pure stdlib (zlib + struct) so it runs anywhere. Anti-aliasing comes from a
signed-distance field rather than supersampling, which keeps it quick and the
edges clean at small sizes.
"""
import math
import os
import struct
import zlib

SIZE = 1024
BG = (0x0B, 0x0B, 0x0D)
FG = (0xF2, 0xF1, 0xED)

BAR_WIDTH = 54.0
BAR_HEIGHT = 470.0
GAP = 140.0
BARS = 4


def segments():
    """Capsule strokes as (x0, y0, x1, y1, radius)."""
    radius = BAR_WIDTH / 2
    total = (BARS - 1) * GAP
    first_x = SIZE / 2 - total / 2
    top = SIZE / 2 - BAR_HEIGHT / 2 + radius
    bottom = SIZE / 2 + BAR_HEIGHT / 2 - radius

    strokes = [(first_x + i * GAP, top, first_x + i * GAP, bottom, radius)
               for i in range(BARS)]

    # The fifth mark, struck across the other four.
    overhang = 66.0
    strokes.append((first_x - overhang, bottom + 18, first_x + total + overhang, top - 18, radius))
    return strokes


def distance_to_segment(px, py, x0, y0, x1, y1):
    dx, dy = x1 - x0, y1 - y0
    length_sq = dx * dx + dy * dy
    if length_sq == 0:
        return math.hypot(px - x0, py - y0)
    t = ((px - x0) * dx + (py - y0) * dy) / length_sq
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (x0 + t * dx), py - (y0 + t * dy))


def render():
    strokes = segments()
    pad = 4
    min_x = int(min(min(s[0], s[2]) - s[4] for s in strokes) - pad)
    max_x = int(max(max(s[0], s[2]) + s[4] for s in strokes) + pad)
    min_y = int(min(min(s[1], s[3]) - s[4] for s in strokes) - pad)
    max_y = int(max(max(s[1], s[3]) + s[4] for s in strokes) + pad)

    row_background = bytes(BG) * SIZE
    rows = [bytearray(row_background) for _ in range(SIZE)]

    for y in range(max(0, min_y), min(SIZE, max_y)):
        py = y + 0.5
        row = rows[y]
        for x in range(max(0, min_x), min(SIZE, max_x)):
            px = x + 0.5
            distance = min(distance_to_segment(px, py, s[0], s[1], s[2], s[3]) - s[4]
                           for s in strokes)
            coverage = 0.5 - distance
            if coverage <= 0:
                continue
            alpha = 1.0 if coverage >= 1 else coverage
            offset = x * 3
            for channel in range(3):
                row[offset + channel] = int(round(BG[channel] + (FG[channel] - BG[channel]) * alpha))

    return rows


def write_png(path, rows):
    raw = b"".join(b"\x00" + bytes(row) for row in rows)

    def chunk(tag, payload):
        data = tag + payload
        return struct.pack(">I", len(payload)) + data + struct.pack(">I", zlib.crc32(data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")

    with open(path, "wb") as handle:
        handle.write(png)


if __name__ == "__main__":
    destination = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "..", "Sip", "Assets.xcassets", "AppIcon.appiconset", "AppIcon.png")
    destination = os.path.normpath(destination)
    os.makedirs(os.path.dirname(destination), exist_ok=True)
    write_png(destination, render())
    print("wrote", destination, os.path.getsize(destination), "bytes")
