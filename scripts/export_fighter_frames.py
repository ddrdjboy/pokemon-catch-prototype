#!/usr/bin/env python3
"""Export one species' 5 attack raws into assets/fx/fighters/<id>/frame_*.png."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPORT = Path(
    "/Users/weigangchen/orca/workspaces/LastFrameImage/shrimpfish"
    "/.cursor/skills/game-pixel-art/scripts/pixel_export.py"
)
CURSOR_ASSETS = Path("/Users/weigangchen/.cursor/projects/Users-weigangchen/assets")
RAW_DIR = ROOT / "assets/pixel/fighter_poc/sprite"
OUT_ROOT = ROOT / "assets/fx/fighters"


def export_species(species_id: str) -> None:
    out = OUT_ROOT / species_id
    out.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    for i in range(5):
        src = CURSOR_ASSETS / f"{species_id}_atk_{i}_raw.jpg"
        if not src.exists():
            src = CURSOR_ASSETS / f"{species_id}_atk_{i}_raw.png"
        if not src.exists():
            raise SystemExit(f"missing raw: {src}")
        staged = RAW_DIR / f"{species_id}_atk_{i}_raw{src.suffix}"
        staged.write_bytes(src.read_bytes())
        dest = out / f"frame_{i}.png"
        cmd = [
            sys.executable,
            str(EXPORT),
            "--input",
            str(staged),
            "--output",
            str(dest),
            "--size",
            "192x192",
            "--key",
            "ff00ff",
            "--epsilon",
            "14",
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        print(r.stdout.strip() or r.stderr.strip())
        if r.returncode != 0:
            raise SystemExit(f"export failed for {species_id} frame {i}")
    print(f"DONE {species_id}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: export_fighter_frames.py <speciesId>")
    export_species(sys.argv[1])
