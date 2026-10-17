#!/usr/bin/env python3
"""Generate simple 8bit-ish transparent FX frames for battle heavy POC."""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "fx"
SIZE = 96
FRAMES = 5

PALETTES = {
    "fire": [(255, 106, 42), (255, 200, 60), (255, 60, 20)],
    "water": [(58, 160, 255), (140, 220, 255), (30, 90, 220)],
    "electric": [(255, 216, 74), (255, 255, 180), (255, 160, 20)],
}


def png_rgba(pixels: list[tuple[int, int, int, int]], w: int, h: int) -> bytes:
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        for x in range(w):
            raw.extend(pixels[y * w + x])

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(
            ">I", zlib.crc32(tag + data) & 0xFFFFFFFF
        )

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


def make_frame(type_id: str, index: int) -> bytes:
    colors = PALETTES[type_id]
    cx = cy = SIZE // 2
    # radius grows then fades
    t = index / (FRAMES - 1)
    radius = 10 + int(28 * t)
    alpha_scale = 1.0 - 0.55 * t
    pixels: list[tuple[int, int, int, int]] = []
    for y in range(SIZE):
        for x in range(SIZE):
            dx, dy = x - cx, y - cy
            d = (dx * dx + dy * dy) ** 0.5
            # chunky pixel rings
            band = int(d) // 3
            if d <= radius and band % 2 == 0:
                c = colors[min(band % len(colors), len(colors) - 1)]
                # hard edge
                a = int(230 * alpha_scale) if d <= radius - 1 else int(120 * alpha_scale)
                # leave center hole later frames for burst feel
                if t > 0.35 and d < radius * 0.35:
                    pixels.append((0, 0, 0, 0))
                else:
                    pixels.append((c[0], c[1], c[2], max(0, min(255, a))))
            else:
                pixels.append((0, 0, 0, 0))
    return png_rgba(pixels, SIZE, SIZE)


def main() -> None:
    for type_id in PALETTES:
        d = OUT / type_id
        d.mkdir(parents=True, exist_ok=True)
        for i in range(FRAMES):
            path = d / f"frame_{i}.png"
            path.write_bytes(make_frame(type_id, i))
            print("wrote", path.relative_to(ROOT))


if __name__ == "__main__":
    main()
