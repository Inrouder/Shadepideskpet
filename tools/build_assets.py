#!/usr/bin/env python3
"""Übernimmt die benötigten Grafiken, Klänge und Schriften aus ShadepiRPG.

Aufruf (aus dem Deskpet-Ordner):
    python tools/build_assets.py <Pfad-zum-ShadepiRPG-Klon>

Das ShadepiRPG-Repository wird nur gelesen. Alle Ausgaben landen unter
app/assets/ und werden in app/assets/manifest.json beschrieben.
Benötigt Python 3 und Pillow.
"""
import json
import shutil
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "app" / "assets"


def _main_band(profile: list, gap: int = 6) -> tuple:
    """Größter zusammenhängender belegter Bereich; trennt Nachbarfragmente ab."""
    bands, start, empty = [], None, 0
    for i, v in enumerate(profile + [0] * (gap + 1)):
        if v:
            if start is None:
                start = i
            empty = 0
        elif start is not None:
            empty += 1
            if empty > gap:
                bands.append((start, i - empty + 1))
                start, empty = None, 0
    if not bands:
        return 0, len(profile)
    return max(bands, key=lambda b: sum(profile[b[0]:b[1]]))


def trim(im: Image.Image, pad: int = 2) -> Image.Image:
    mask = im.getchannel("A").point(lambda a: 255 if a > 24 else 0)
    w, h = mask.size
    px = mask.load()
    rows = [sum(1 for x in range(0, w, 2) if px[x, y]) for y in range(h)]
    t, b = _main_band(rows)
    sub = mask.crop((0, t, w, b))
    spx = sub.load()
    cols = [sum(1 for y in range(0, sub.height, 2) if spx[x, y]) for x in range(w)]
    l, r = _main_band(cols)
    im = im.crop((max(0, l - pad), max(0, t - pad), min(w, r + pad), min(h, b + pad)))
    return im


def fit(im: Image.Image, longest: int) -> Image.Image:
    s = longest / max(im.size)
    if s >= 1:
        return im
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)


def main(src: Path) -> None:
    if not (src / "project.godot").exists():
        sys.exit(f"{src} sieht nicht wie ein ShadepiRPG-Klon aus (project.godot fehlt)")
    for sub in ["heroes", "enemies", "props", "fx", "ui", "fonts", "audio", "music"]:
        (OUT / sub).mkdir(parents=True, exist_ok=True)
    manifest: dict = {"source": "https://github.com/Inrouder/ShadepiRPG", "notes": "Automatisch aus ShadepiRPG übernommen; nicht von Hand bearbeiten."}

    # --- Helden: 8 Spalten x 32 Zeilen, Zelle 128x160, Fußpunkt y=152 ------------
    for name in ["raven", "shadepi"]:
        shutil.copy(src / f"assets/sprites/heroes/{name}.png", OUT / "heroes" / f"{name}.png")
    shutil.copy(src / "assets/sprites/heroes/combat-poses.png", OUT / "heroes" / "combat-poses.png")
    # Fußpunkte der Sonderposen (8 Richtungen x 4 Zeilen, Zelle 192x256) messen:
    # Zeile 0 Shadepi-Aufladen, 1 Knie, 2 Tritt, 3 Raven-Hocke.
    poses = Image.open(src / "assets/sprites/heroes/combat-poses.png").convert("RGBA")
    anchors = []
    for row in range(4):
        for col in range(8):
            cell = poses.crop((col * 192, row * 256, col * 192 + 192, row * 256 + 256)).getchannel("A")
            solid = cell.point(lambda a: 255 if a > 200 else 0)
            l, t, r, b = solid.getbbox() or (0, 0, 192, 256)
            foot = solid.crop((0, max(t, b - 24), 192, b)).getbbox() or (l, 0, r, 0)
            anchors.append({"x": (foot[0] + foot[2]) / 2, "y": b, "top": t})
    manifest["combatPoses"] = anchors
    # Raven sitzend / liegend aus den Heiligtum-Posen (an die Spielhelden angepasst).
    # Maßstab: stehende Raven dort 426 px hoch, im Atlas 117 px -> Faktor in Atlaspixeln.
    sanct = Image.open(src / "assets/story/sanctuary/poses-game.png").convert("RGBA")
    rest = {}
    for name, region, anchor in [("raven-sit", (0, 512, 410, 1024), (246, 300)), ("raven-lie", (472, 512, 1024, 1024), (240, 352))]:
        cell = sanct.crop(region)
        alpha = cell.getchannel("A").point(lambda a: 255 if a > 24 else 0)
        l, t, r, b = alpha.getbbox()
        l, t, r, b = max(0, l - 4), max(0, t - 4), min(cell.width, r + 4), min(cell.height, b + 4)
        cell.crop((l, t, r, b)).save(OUT / "heroes" / f"{name}.png", optimize=True)
        rest[name] = {"anchor": [anchor[0] - l, anchor[1] - t], "scale": 117 / 426}
    manifest["rest"] = rest

    # --- Cyberpunks / Schützen / Bosse: gleiches Atlasformat wie die Helden -------
    npcs = ["punk-1", "punk-2", "punk-3", "punk-4", "shooter-visor", "shooter-violet", "jackal"]
    for name in npcs:
        shutil.copy(src / f"assets/sprites/npcs/{name}.png", OUT / "enemies" / f"{name}.png")

    # --- Kampfbot aus der Erinnerung "Angriff" ------------------------------------
    shutil.copy(src / "assets/memories/attack/bots.png", OUT / "enemies" / "bot.png")
    actors = json.loads((src / "assets/memories/attack/actors.json").read_text())
    manifest["bot"] = actors["bot"]

    # --- Digitale Gegner: Einzelillustrationen verkleinern ------------------------
    fit(trim(Image.open(src / "assets/sprites/npcs/dive-virus.png").convert("RGBA")), 200).save(OUT / "enemies" / "virus.png", optimize=True)
    fit(trim(Image.open(src / "assets/sprites/npcs/ice-guardian.png").convert("RGBA")), 300).save(OUT / "enemies" / "ice.png", optimize=True)

    # --- Drohne: Fahrzeugatlas Zelle 3 (627x627) ----------------------------------
    veh = Image.open(src / "assets/world/hq/vehicles.png").convert("RGBA")
    fit(trim(veh.crop((627, 627, 1254, 1254))), 220).save(OUT / "enemies" / "drone.png", optimize=True)

    # --- Requisiten: 9 Spalten x 3 Zustände -----------------------------------------
    props = Image.open(src / "assets/world/hq/props.png").convert("RGBA")
    cw, ch = props.width / 9, props.height / 3
    names = ["crate", "barrel", "lamp", "car", "dumpster", "fusebox", "vending", "server", "holocube"]
    keep = {"crate", "barrel", "server", "holocube", "vending", "fusebox"}
    for col, name in enumerate(names):
        if name not in keep:
            continue
        for row, state in enumerate(["intact", "damaged", "broken"]):
            cell = props.crop((round(col * cw), round(row * ch), round((col + 1) * cw), round((row + 1) * ch)))
            fit(trim(cell), 160).save(OUT / "props" / f"{name}-{state}.png", optimize=True)

    # --- FX ----------------------------------------------------------------------
    for name in ["bullet", "muzzle", "lightning"]:
        shutil.copy(src / f"assets/fx/{name}.png", OUT / "fx" / f"{name}.png")
    pfx = Image.open(src / "assets/memories/attack/props-fx.png").convert("RGBA")
    # Zeilen: 0 Trümmer, 1 Feuer, 2 Rauch, 3 Explosion; je 4 Bilder à 384x256
    for row, name in [(1, "fire"), (2, "smoke"), (3, "explosion")]:
        strip = pfx.crop((0, row * 256, 1536, row * 256 + 256)).resize((768, 128), Image.LANCZOS)
        strip.save(OUT / "fx" / f"{name}.png", optimize=True)

    # --- Pixel-UI (Raven-Thema) --------------------------------------------------
    for part in ["frame", "header", "cells", "parts"]:
        shutil.copy(src / f"assets/ui/raven/{part}.png", OUT / "ui" / f"{part}.png")
    button = Image.open(src / "assets/ui/raven/button.png").convert("RGBA")
    for i, state in enumerate(["normal", "hover", "pressed", "disabled"]):
        button.crop((0, i * 18, 64, i * 18 + 18)).save(OUT / "ui" / f"button-{state}.png")
    for theme in ["order", "tower"]:
        shutil.copy(src / f"assets/ui/{theme}/frame.png", OUT / "ui" / f"frame-{theme}.png")
    shutil.copy(src / "assets/icon.png", OUT / "ui" / "icon.png")
    icon = Image.open(src / "assets/icon.png").convert("RGBA")
    icon.resize((32, 32), Image.LANCZOS).save(OUT / "ui" / "tray.png")
    icon.resize((16, 16), Image.LANCZOS).save(OUT / "ui" / "tray16.png")
    (ROOT / "build").mkdir(exist_ok=True)
    icon.resize((256, 256), Image.NEAREST).save(ROOT / "build" / "icon.png")

    # --- Schriften ---------------------------------------------------------------
    for f in ["ShadepiPixel.ttf", "Silkscreen-Regular.ttf", "OFL-Silkscreen.txt", "OFL-ShadepiPixel-Jersey10.txt"]:
        shutil.copy(src / "assets/fonts" / f, OUT / "fonts" / f)

    # --- Klänge ------------------------------------------------------------------
    sounds = ["hit", "slash", "pistol", "electric", "hack", "enemy_attack_0", "enemy_attack_1",
              "enemy_hurt_0", "enemy_hurt_1", "enemy_hurt_2", "enemy_death_0", "enemy_death_1", "enemy_death_2",
              "prop_blast", "prop_metal", "prop_wood", "prop_hit", "drive_explosion", "drive_laser",
              "drive_laser_warn", "drive_shot", "drive_knock", "drive_near_miss", "calib_accept", "calib_error",
              "calib_lock", "calib_tick", "calib_alarm", "legacy_aura", "legacy_transfer"]
    for s in sounds:
        shutil.copy(src / f"assets/audio/{s}.wav", OUT / "audio" / f"{s}.wav")
    manifest["sounds"] = sounds
    for m in ["Fight", "Boss"]:
        shutil.copy(src / f"assets/music/{m}.mp3", OUT / "music" / f"{m}.mp3")

    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    # Zusätzlich als Skript, damit die Seite auch per file:// ohne fetch startet.
    (OUT / "manifest.js").write_text("window.PET_MANIFEST = " + json.dumps(manifest, ensure_ascii=False) + ";\n")
    total = sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file())
    print(f"Fertig: {sum(1 for p in OUT.rglob('*') if p.is_file())} Dateien, {total / 1e6:.1f} MB in {OUT}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]).resolve())
