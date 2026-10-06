
#!/usr/bin/env python3
"""Helpers for pokemon_8bit_all pack: prompt text + export install."""
from __future__ import annotations
import json, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "assets/pixel/pokemon_8bit_all"
MANIFEST = PACK / "manifest.json"
SPRITE = PACK / "sprite"
GAME = ROOT / "assets/pokemon"
EXPORT = Path("/Users/weigangchen/orca/workspaces/LastFrameImage/shrimpfish/.cursor/skills/game-pixel-art/scripts/pixel_export.py")

STYLE = (
  "8-bit pixel art game asset, NES/Game Boy feel, very limited palette, chunky pixels, "
  "bold silhouette, flat shading only, hard pixel edges, no gradients, no anti-alias, "
  "no soft glow fringe, no photorealism, "
)
TYPE = (
  "single game character or creature sprite, centered, readable silhouette, "
  "game sprite sheet frame look, no background scenery, no text, no watermark, "
)
SIZE = "designed for about 192x192 pixel art resolution, chunky readable pixels, "
KEY = (
  "flat solid magenta background #FF00FF, no checkerboard, no gradient backdrop, "
  "subject fully opaque against the magenta, "
)

def load():
    return json.loads(MANIFEST.read_text(encoding="utf-8"))

def full_prompt(asset: dict) -> str:
    title = asset.get("title")
    body = asset["prompt"]
    if title:
        body = f"Title mood: {title}. {body}"
    return STYLE + TYPE + SIZE + KEY + body

def prompt_cmd(ids: list[str]) -> None:
    m = load()
    by = {a["id"]: a for a in m["assets"]}
    for i in ids:
        a = by[i]
        print(f"===== {i} =====")
        print(full_prompt(a))
        print()

def export_install(ids: list[str], epsilon: int = 14) -> None:
    SPRITE.mkdir(parents=True, exist_ok=True)
    for i in ids:
        raws = list(SPRITE.glob(f"{i}_raw.*"))
        if not raws:
            print(f"MISSING_RAW {i}", file=sys.stderr)
            continue
        raw = raws[0]
        out = SPRITE / f"{i}.png"
        cmd = [
            sys.executable, str(EXPORT),
            "--input", str(raw),
            "--output", str(out),
            "--size", "192x192",
            "--key", "ff00ff",
            "--epsilon", str(epsilon),
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        print(r.stdout.strip() or r.stderr.strip())
        if r.returncode != 0:
            print(f"FAIL_EXPORT {i}", file=sys.stderr)
            continue
        shutil.copy2(out, GAME / f"{i}.png")
        print(f"INSTALLED {i}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("usage: prompt|export id [id...]")
        sys.exit(2)
    op, *ids = sys.argv[1:]
    if op == "prompt":
        prompt_cmd(ids)
    elif op == "export":
        export_install(ids)
    else:
        sys.exit(2)
