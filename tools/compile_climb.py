#!/usr/bin/env python3
"""Packt neue Kletter-/Kanten-Keyframes für das Deskpet – wie ShadepiRPG/tools/compile_heroes.py.

Eingabe:  tools/climb_sources/<held>-climb-keyframes.png  (1536×1024, 8×4 Zellen à 192×256,
          erzeugt nach tools/climb_sources/prompts.json mit dem Spiel-Keyframe-Atlas als Referenz)
Ausgabe:  app/assets/heroes/<held>-climb.png      Reihe 1: Klettern Rückansicht (8 Bilder)
          app/assets/heroes/<held>-mantle.png     Reihe 2: Hochziehen auf die Kante (8)
          app/assets/heroes/<held>-ledge.png      Reihe 3: Auf der Kante sitzen (8)
          app/assets/heroes/<held>-climbside.png  Reihe 4: Klettern im Profil (4 Ost + 4 West)
          app/assets/heroes/climb-art.js          Kantenhöhen je Bild für das Spiel

Die Figuren werden nicht neu gezeichnet: Jede Zelle wird freigestellt (größte sichtbare Fläche +
halbtransparente Ränder), mit Originalfarben auf 50 % verkleinert und ohne Neuzentrieren in eine
128×160-Zelle gelegt (Zellmaß × 0,5, Fußlinie 92 % → y = 152), damit die Bewegung erhalten bleibt.
Feinkorrekturen pro Bild: tools/climb_sources/<held>-offsets.json  {"mantle": [[dx,dy], …], …}

Aufruf: python tools/compile_climb.py [raven|shadepi …]
"""
import json
import sys
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "climb_sources"
OUT = ROOT / "app" / "assets" / "heroes"
CELL = (192, 256)
FRAME = (128, 160)
SCALE = 0.5
OX = (FRAME[0] - CELL[0] * SCALE) / 2          # 16
OY = 152 - 0.92 * CELL[1] * SCALE              # ≈ 34.2
ROWS = ["climb", "mantle", "ledge", "climbside"]
GRID = json.loads((SRC / "prompts.json").read_text(encoding="utf-8"))["source_grid"]


def frame_y(cell_fraction):
    """Zellhöhe (0..1) → y im 128×160-Bild."""
    return round(OY + cell_fraction * CELL[1] * SCALE, 1)


def isolate(cell):
    """Größte zusammenhängende sichtbare Fläche + ihre weichen Ränder behalten."""
    w, h = cell.size
    alpha = cell.getchannel("A").tobytes()
    labels = [0] * (w * h)
    sizes = [0]
    comp = 0
    for start, a in enumerate(alpha):
        if a < 32 or labels[start]:
            continue
        comp += 1
        labels[start] = comp
        stack, n = [start], 0
        while stack:
            i = stack.pop(); n += 1
            x, y = i % w, i // w
            for j in ((i - 1) if x else -1, (i + 1) if x + 1 < w else -1, (i - w) if y else -1, (i + w) if y + 1 < h else -1):
                if j >= 0 and not labels[j] and alpha[j] >= 32:
                    labels[j] = comp; stack.append(j)
        sizes.append(n)
    if not comp:
        return cell
    main = max(range(1, comp + 1), key=sizes.__getitem__)
    keep = bytearray(w * h)
    queue = deque()
    for i, l in enumerate(labels):
        if l == main:
            keep[i] = 1; queue.append((i, 0))
    while queue:  # halbtransparente Ränder bis 10 px anhängen
        i, d = queue.popleft()
        if d >= 10:
            continue
        x, y = i % w, i // w
        for j in ((i - 1) if x else -1, (i + 1) if x + 1 < w else -1, (i - w) if y else -1, (i + w) if y + 1 < h else -1):
            if j >= 0 and not keep[j] and alpha[j] and not labels[j]:
                keep[j] = 1; queue.append((j, d + 1))
    mask = Image.frombytes("L", (w, h), bytes(a if k else 0 for a, k in zip(alpha, keep)))
    out = cell.copy(); out.putalpha(mask)
    return out


def build(name):
    path = SRC / f"{name}-climb-keyframes.png"
    if not path.exists():
        print(f"– {name}: {path.relative_to(ROOT)} fehlt, übersprungen")
        return None
    src = Image.open(path).convert("RGBA")
    if src.size != (CELL[0] * 8, CELL[1] * 4):
        src = src.resize((CELL[0] * 8, CELL[1] * 4), Image.LANCZOS)
        print(f"  Hinweis: {name} auf 1536×1024 skaliert")
    offsets = {}
    off_path = SRC / f"{name}-offsets.json"
    if off_path.exists():
        offsets = json.loads(off_path.read_text(encoding="utf-8"))
    for r, row_name in enumerate(ROWS):
        strip = Image.new("RGBA", (FRAME[0] * 8, FRAME[1]))
        for c in range(8):
            cell = isolate(src.crop((c * CELL[0], r * CELL[1], (c + 1) * CELL[0], (r + 1) * CELL[1])))
            small = cell.resize((round(CELL[0] * SCALE), round(CELL[1] * SCALE)), Image.LANCZOS)
            dx, dy = (offsets.get(row_name) or [[0, 0]] * 8)[c]
            frame = Image.new("RGBA", FRAME)
            frame.alpha_composite(small, (round(OX + dx), round(OY + dy)))
            strip.alpha_composite(frame, (c * FRAME[0], 0))
        strip.save(OUT / f"{name}-{row_name}.png", optimize=True)
    print(f"✓ {name}: Kletter-, Hochzieh-, Sitz- und Profilbilder erzeugt")
    return name


def main(names):
    done = [n for n in names if build(n)]
    ledge = GRID["ledge_line"]
    meta = {
        "heroes": sorted(set(done) | set(json.loads((OUT / "climb-art.json").read_text())["heroes"] if (OUT / "climb-art.json").exists() else [])),
        "mantleLedgeY": [frame_y(f) for f in ledge["row2"]],
        "ledgeSeatY": frame_y(ledge["row3"]),
        "climbHandY": frame_y(0.06),
    }
    (OUT / "climb-art.json").write_text(json.dumps(meta, indent=1))
    (OUT / "climb-art.js").write_text("window.PET_CLIMB_ART = " + json.dumps(meta) + ";\n")
    print("Kantenhöhen:", meta)


if __name__ == "__main__":
    main(sys.argv[1:] or ["raven", "shadepi"])
