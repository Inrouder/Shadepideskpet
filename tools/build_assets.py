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


def _components(alpha, w, h, thr=32):
    labels = [0] * (w * h)
    sizes = [0]
    comp = 0
    for start in range(w * h):
        if alpha[start] < thr or labels[start]:
            continue
        comp += 1
        labels[start] = comp
        stack, n = [start], 0
        while stack:
            i = stack.pop(); n += 1
            x, y = i % w, i // w
            for j in ((i - 1) if x else -1, (i + 1) if x + 1 < w else -1, (i - w) if y else -1, (i + w) if y + 1 < h else -1):
                if j >= 0 and not labels[j] and alpha[j] >= thr:
                    labels[j] = comp; stack.append(j)
        sizes.append(n)
    return labels, sizes, comp


def isolate_frame(sheet, region, pad=70):
    """Figur aus ihrer Zelle lösen: eigene Fläche behalten (auch über die Zellgrenze ragende
    Klingenspitzen), Bruchstücke der Nachbarbilder entfernen. Gibt Bild + Versatz zurück."""
    x0, y0, w0, h0 = region
    X0, Y0 = max(0, x0 - pad), max(0, y0 - 10)
    X1, Y1 = min(sheet.width, x0 + w0 + pad), min(sheet.height, y0 + h0 + 10)
    crop = sheet.crop((X0, Y0, X1, Y1))
    w, h = crop.size
    alpha = crop.getchannel("A").tobytes()
    labels, sizes, comp = _components(alpha, w, h)
    if not comp:
        return crop, (X0, Y0)
    # Fläche mit den meisten Pixeln innerhalb der eigenen Zelle
    inside = [0] * (comp + 1)
    for i, l in enumerate(labels):
        if l:
            x, y = i % w + X0, i // w + Y0
            if x0 <= x < x0 + w0 and y0 <= y < y0 + h0:
                inside[l] += 1
    main = max(range(1, comp + 1), key=inside.__getitem__)
    # nahe kleine Teile (Mündungsfeuer, lose Haarsträhnen) dazunehmen, wenn sie die Hauptfläche fast berühren
    keep = {main}
    mx = [w, h, 0, 0]
    for i, l in enumerate(labels):
        if l == main:
            x, y = i % w, i // w
            mx = [min(mx[0], x), min(mx[1], y), max(mx[2], x), max(mx[3], y)]
    boxes = {}
    for i, l in enumerate(labels):
        if l and l != main:
            x, y = i % w, i // w
            b = boxes.get(l, [x, y, x, y])
            boxes[l] = [min(b[0], x), min(b[1], y), max(b[2], x), max(b[3], y)]
    for l, b in boxes.items():
        near = b[0] <= mx[2] + 6 and b[2] >= mx[0] - 6 and b[1] <= mx[3] + 6 and b[3] >= mx[1] - 6
        cx = (b[0] + b[2]) / 2 + X0
        if near and inside[l] > 0 and sizes[l] >= 80 and x0 + 8 < cx < x0 + w0 - 8:
            keep.add(l)
    from collections import deque
    mask = bytearray(w * h)
    q = deque()
    for i, l in enumerate(labels):
        if l in keep:
            mask[i] = 1; q.append((i, 0))
    while q:
        i, d = q.popleft()
        if d >= 8:
            continue
        x, y = i % w, i // w
        for j in ((i - 1) if x else -1, (i + 1) if x + 1 < w else -1, (i - w) if y else -1, (i + w) if y + 1 < h else -1):
            if j >= 0 and not mask[j] and alpha[j] and not labels[j]:
                mask[j] = 1; q.append((j, d + 1))
    m = Image.frombytes("L", (w, h), bytes(a if k else 0 for a, k in zip(alpha, mask)))
    crop.putalpha(m)
    box = m.getbbox() or (0, 0, w, h)
    return crop.crop(box), (X0 + box[0], Y0 + box[1])


def pack_brothers(src, actors):
    """Oni, Roboterkopf, Ly und den schweren MG-Krieger für den Dojo-Modus neu packen:
    Stand/Laufen nur vorn, links, rechts; die ganze Kampffolge (rechts blickend)."""
    sheets = {
        "idle": Image.open(src / "assets/memories/attack/warriors-ready.png").convert("RGBA"),
        "run_a": Image.open(src / "assets/memories/attack/warriors-run.png").convert("RGBA"),
        "run_b": Image.open(src / "assets/memories/attack/warriors-run.png").convert("RGBA"),
        "combat": Image.open(src / "assets/memories/attack/combat.png").convert("RGBA"),
    }
    half = 0.5
    frames, out = [], {}
    for who in ["oni", "robot", "ly", "heavy"]:
        out[who] = {}
        for state, idxs in [("idle", [0, 1, 2]), ("run_a", [1, 2]), ("run_b", [1, 2]), ("combat", list(range(8)))]:
            out[who][state] = {}
            for i in idxs:
                e = actors[who][state][i]
                img, (ox, oy) = isolate_frame(sheets[state], e["region"])
                img = img.resize((max(1, round(img.width * half)), max(1, round(img.height * half))), Image.LANCZOS)
                ax = (e["region"][0] + e["anchor"][0] - ox) * half
                ay = (e["region"][1] + e["anchor"][1] - oy) * half
                frames.append((who, state, i, img, ax, ay, e["scale"] / half))
    # Regalpacken in eine Textur
    W = 2048
    x = y = rowh = 0
    placed = []
    for f in sorted(frames, key=lambda t: -t[3].height):
        img = f[3]
        if x + img.width + 2 > W:
            x, y, rowh = 0, y + rowh + 2, 0
        placed.append((f, x, y))
        x += img.width + 2
        rowh = max(rowh, img.height)
    atlas = Image.new("RGBA", (W, y + rowh + 2))
    for (who, state, i, img, ax, ay, sc), px, py in placed:
        atlas.alpha_composite(img, (px, py))
        out[who][state][str(i)] = {"region": [px, py, img.width, img.height], "anchor": [round(ax, 1), round(ay, 1)], "scale": round(sc, 5)}
    for who in out:
        for state in out[who]:
            out[who][state] = {k: v for k, v in out[who][state].items() if k.isdigit()}
    atlas.save(OUT / "enemies" / "brothers.png", optimize=True)
    return out


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

    # --- Ordensbrüder (Dojo-Modus): Stand/Laufen/Kampffolge aus der Erinnerung „Angriff" ---
    manifest["warriors"] = pack_brothers(src, actors)

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
