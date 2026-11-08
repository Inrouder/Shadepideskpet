#!/usr/bin/env python3
"""Erzeugt Kletteranimationen aus der Rückansicht der Heldenatlanten.

Die Rückansicht (Stand, Richtung „oben“) wird in Körper, Arme und Beine zerlegt.
Die Arme greifen abwechselnd nach oben, die Beine stemmen sich gegenläufig.
Keine neu gezeichneten Figuren – nur die vorhandenen Pixel werden bewegt.

Aufruf: python tools/build_climb.py   (liest/schreibt app/assets/heroes/)
Ausgabe: <held>-climb.png  (8 Bilder à 128×160 nebeneinander, Füße bei y=152)
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
HEROES = ROOT / "app" / "assets" / "heroes"

# Arm-Umrisse (Atlaspixel) und Schultergelenke, Beinbereich ab y
RIG = {
    "raven": {
        "arm_l": [(43, 61), (52, 61), (54, 79), (53, 92), (48, 111), (38, 111), (39, 80), (42, 70)],
        "arm_r": [(76, 61), (85, 61), (87, 70), (90, 80), (90, 111), (80, 111), (75, 92), (75, 79)],
        "sh_l": (48, 66), "sh_r": (80, 66),
        "legs_y": 108, "mid": 64, "auto_arms": (60, 109),
    },
    "shadepi": {
        "arm_l": [(41, 63), (47, 63), (47, 84), (46, 110), (35, 110), (35, 88), (37, 72)],
        "arm_r": [(75, 63), (81, 63), (85, 72), (87, 88), (87, 110), (76, 110), (75, 84)],
        "sh_l": (45, 67), "sh_r": (77, 67),
        "legs_y": 124, "mid": 61,
        "leg_l": [(40, 126), (57, 126), (57, 160), (38, 160)], "leg_r": [(64, 126), (81, 126), (82, 160), (64, 160)],
        "erase_red_x": 82,   # Klinge rechts unten ausblenden (beim Klettern weggesteckt)
    },
}

FRAMES = 8


def mask_from_poly(poly, size=(128, 160)):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    return m


def cut(img, mask):
    part = Image.new("RGBA", img.size, (0, 0, 0, 0))
    part.paste(img, (0, 0), mask)
    rest = img.copy()
    hole = Image.new("RGBA", img.size, (0, 0, 0, 0))
    rest.paste(hole, (0, 0), mask)
    return part, rest


def rotate_about(part, angle, pivot, ss=4):
    # PIL dreht gegen den Uhrzeigersinn (Bildschirmansicht); 4-fach überabgetastet für saubere Kanten
    w, h = part.size
    big = part.resize((w * ss, h * ss), Image.LANCZOS)
    big = big.rotate(angle, resample=Image.BICUBIC, center=(pivot[0] * ss, pivot[1] * ss))
    return big.resize((w, h), Image.LANCZOS)


def auto_arm_masks(img, y0, y1):
    """Arme dort, wo sie frei neben dem Körper hängen, exakt aus den Pixelläufen; oben eine Schulterkappe."""
    a = img.getchannel("A").load()
    ml, mr = Image.new("L", img.size, 0), Image.new("L", img.size, 0)
    dl, dr = ImageDraw.Draw(ml), ImageDraw.Draw(mr)
    for y in range(y0, y1 + 1):
        runs, start = [], None
        for x in range(128):
            on = a[x, y] > 40
            if on and start is None:
                start = x
            if not on and start is not None:
                runs.append((start, x - 1)); start = None
        if start is not None:
            runs.append((start, 127))
        if not runs:
            continue
        if len(runs) >= 2:
            if runs[0][0] < 46 and runs[0][1] - runs[0][0] < 14:
                dl.line((runs[0][0], y, runs[0][1], y), fill=255)
            if runs[-1][1] > 82 and runs[-1][1] - runs[-1][0] < 14:
                dr.line((runs[-1][0], y, runs[-1][1], y), fill=255)
        elif len(runs) == 1 and runs[0][1] - runs[0][0] > 30:
            dl.line((runs[0][0], y, runs[0][0] + 7, y), fill=255)
            dr.line((runs[0][1] - 7, y, runs[0][1], y), fill=255)
    return ml, mr


def squash_leg(leg, rig, d):
    """Bein anziehen: unteren Teil stauchen, Hüfte bleibt stehen (keine Naht)."""
    if d <= 0:
        return leg
    box = leg.getbbox()
    if not box:
        return leg
    l, t, r, b = box
    part = leg.crop((l, t, r, b))
    h = b - t
    part = part.resize((r - l, max(1, h - d)), Image.LANCZOS)
    out = Image.new("RGBA", leg.size, (0, 0, 0, 0))
    out.alpha_composite(part, (l, t))
    return out


def build(name):
    atlas = Image.open(HEROES / f"{name}.png").convert("RGBA")
    base = atlas.crop((0, 3 * 160, 128, 4 * 160))  # Stand, Richtung oben
    rig = RIG[name]
    if "erase_red_x" in rig:
        px = base.load()
        for y in range(100, 160):
            for x in range(rig["erase_red_x"], 128):
                r, g, b, a = px[x, y]
                if a and r > g + 30:
                    px[x, y] = (0, 0, 0, 0)
    if "auto_arms" in rig:
        ml, mr = auto_arm_masks(base, *rig["auto_arms"])
    else:
        ml, mr = mask_from_poly(rig["arm_l"]), mask_from_poly(rig["arm_r"])
    arm_l, rest = cut(base, ml)
    arm_r, rest = cut(rest, mr)
    # Beine: Entfernen ab legs_y, Kopie aber 6 px höher beginnen (Überlappung unter dem Körper → keine Naht)
    if "leg_l" in rig:
        def up(poly):
            return [(x, y - 6 if y == min(p[1] for p in poly) else y) for x, y in poly]
        leg_l, _ = cut(rest, mask_from_poly(up(rig["leg_l"])))
        leg_r, _ = cut(rest, mask_from_poly(up(rig["leg_r"])))
        _, body = cut(rest, mask_from_poly(rig["leg_l"]))
        _, body = cut(body, mask_from_poly(rig["leg_r"]))
    else:
        top = rig["legs_y"]
        lm = mask_from_poly([(0, top - 6), (rig["mid"], top - 6), (rig["mid"], 160), (0, 160)])
        rm = mask_from_poly([(rig["mid"] + 1, top - 6), (127, top - 6), (127, 160), (rig["mid"] + 1, 160)])
        leg_l, _ = cut(rest, lm)
        leg_r, _ = cut(rest, rm)
        cutm = Image.new("L", base.size, 0)
        ImageDraw.Draw(cutm).rectangle((0, top, 127, 159), fill=255)
        _, body = cut(rest, cutm)

    sheet = Image.new("RGBA", (128 * FRAMES, 160), (0, 0, 0, 0))
    for f in range(FRAMES):
        ph = f / FRAMES * 2 * math.pi
        s = math.sin(ph)
        # Arme: der obere greift fast senkrecht, der andere zieht angewinkelt
        # links im Uhrzeigersinn nach außen-oben, rechts gegenläufig (Y-Haltung, abwechselnd höher)
        ang_l = -(150 + 20 * s)
        ang_r = 150 - 20 * s
        lift = round(3 * math.cos(ph * 2))  # Körper hebt sich beim Ziehen
        frame = Image.new("RGBA", base.size, (0, 0, 0, 0))
        al = rotate_about(arm_l, ang_l, rig["sh_l"])
        ar = rotate_about(arm_r, ang_r, rig["sh_r"])
        # Beine gegenläufig zu den Armen
        k = 3 if "leg_l" in rig else 5
        dl = round(-k * max(0, -s))
        dr = round(-k * max(0, s))
        frame.alpha_composite(al, (0, lift))
        frame.alpha_composite(ar, (0, lift))
        frame.alpha_composite(squash_leg(leg_l, rig, -dl), (0, 0))
        frame.alpha_composite(squash_leg(leg_r, rig, -dr), (0, 0))
        frame.alpha_composite(body, (0, lift))
        sheet.alpha_composite(frame, (f * 128, 0))
    sheet.save(HEROES / f"{name}-climb.png", optimize=True)
    return sheet


if __name__ == "__main__":
    for n in RIG:
        build(n)
    print("Kletterbilder erzeugt.")
