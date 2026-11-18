#!/usr/bin/env python3
"""Übernimmt die Arcade-Grafiken aus ShadepiRPG (NEON KOMBAT, v0.61+):

- zehn Kämpferblätter (je 16 Posen, Zelle 512x320, Fußanker 224/288) → app/assets/arcade/fighters-*.png
- Ravens Drohne und Shadepis Naniten → app/assets/arcade/drone.png, nanites.png
- Material-/Effektblatt (Treffer, EMP, Plasma …) → app/assets/arcade/fx.png
- die Ordensbrüder (aktualisierte Bögen) → app/assets/enemies/brothers.png

Aufruf:  python tools/build_arcade.py <Pfad-zum-ShadepiRPG-Klon>
Das ShadepiRPG-Repository wird nur gelesen. Ergänzt app/assets/manifest.json/.js.
"""
import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_assets import OUT, pack_brothers  # noqa: E402

KEEP = 0.6          # Auflösung der übernommenen Posen (Anteil der Quelle)
UNIT = 0.51         # Quellpixel → Figurenmaß der Desktop-Helden (Höhe wie die bisherigen Atlanten)


def bbox(cell):
    a = cell.getchannel("A").point(lambda v: 255 if v > 10 else 0)
    return a.getbbox()


def pack_arcade(src: Path) -> dict:
    atlas_info = json.loads((src / "assets/arcade/fighters/atlas.json").read_text())
    cw, ch = atlas_info["cell"]
    ax0, ay0 = atlas_info["anchor"]
    frames = []
    fighters = {}
    for fid, info in atlas_info["fighters"].items():
        sheet = Image.open(src / f"assets/arcade/fighters/{fid}.png").convert("RGBA")
        fighters[fid] = {"frames": [None] * 16, "emitter": info.get("emitter", [78, -158])}
        for i in range(16):
            cx, cy = (i % 4) * cw, (i // 4) * ch
            cell = sheet.crop((cx, cy, cx + cw, cy + ch))
            b = bbox(cell)
            if not b:
                continue
            l, t, r, btm = max(0, b[0] - 2), max(0, b[1] - 2), min(cw, b[2] + 2), min(ch, b[3] + 2)
            img = cell.crop((l, t, r, btm))
            img = img.resize((max(1, round(img.width * KEEP)), max(1, round(img.height * KEEP))), Image.LANCZOS)
            frames.append((fid, i, img, (ax0 - l) * KEEP, (ay0 - t) * KEEP))
    # Regalpacken in Texturen bis 2048x2048
    sheets, placed = [], []
    W, H = 2048, 2048
    x = y = rowh = 0
    cur = 0
    for f in sorted(frames, key=lambda t: -t[2].height):
        img = f[2]
        if x + img.width + 2 > W:
            x, y, rowh = 0, y + rowh + 2, 0
        if y + img.height + 2 > H:
            cur += 1
            x = y = rowh = 0
        placed.append((f, cur, x, y))
        x += img.width + 2
        rowh = max(rowh, img.height)
    n = cur + 1
    heights = [0] * n
    for (f, s, px, py) in placed:
        heights[s] = max(heights[s], py + f[2].height + 2)
    sheets = [Image.new("RGBA", (W, heights[s])) for s in range(n)]
    for (fid, i, img, ax, ay), s, px, py in placed:
        sheets[s].alpha_composite(img, (px, py))
        fighters[fid]["frames"][i] = {"s": s, "r": [px, py, img.width, img.height], "a": [round(ax, 1), round(ay, 1)]}
    (OUT / "arcade").mkdir(parents=True, exist_ok=True)
    for s, im in enumerate(sheets):
        im.save(OUT / "arcade" / f"fighters-{s}.png", optimize=True)
    return {"keep": KEEP, "unit": UNIT, "poses": atlas_info["poses"], "sheets": n, "fighters": fighters}


def main(src: Path) -> None:
    if not (src / "project.godot").exists():
        sys.exit(f"{src} sieht nicht wie ein ShadepiRPG-Klon aus (project.godot fehlt)")
    manifest = json.loads((OUT / "manifest.json").read_text())
    manifest["arcade"] = pack_arcade(src)
    # Begleiter: Drohne 4x2 Zellen à 160 (oben Rotoren, unten Feuer), Naniten 4x2 à 64 (weiß/rot)
    Image.open(src / "assets/sprites/companions/drone-hq.png").convert("RGBA").resize((320, 160), Image.LANCZOS).save(OUT / "arcade" / "drone.png", optimize=True)
    Image.open(src / "assets/sprites/companions/nanites-hq.png").convert("RGBA").resize((128, 64), Image.LANCZOS).save(OUT / "arcade" / "nanites.png", optimize=True)
    # Effektblatt 4x4 Zellen: 0 Bake/Mine/Öl/Boost, 1 Cyanblitz/Patronenspur/Violettplasma/Kontaktschatten,
    # 2 vier Trefferphasen, 3 vier EMP-Phasen
    Image.open(src / "assets/arcade/props-fx-hq.png").convert("RGBA").resize((512, 512), Image.LANCZOS).save(OUT / "arcade" / "fx.png", optimize=True)
    actors = json.loads((src / "assets/memories/attack/actors.json").read_text())
    manifest["warriors"] = pack_brothers(src, actors)
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    (OUT / "manifest.js").write_text("window.PET_MANIFEST = " + json.dumps(manifest, ensure_ascii=False) + ";\n")
    size = sum(p.stat().st_size for p in (OUT / "arcade").glob("*.png"))
    print(f"Arcade: {len(manifest['arcade']['fighters'])} Kämpfer in {manifest['arcade']['sheets']} Texturen, {size / 1e6:.1f} MB")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]).resolve())
