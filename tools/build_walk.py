"""Zwischenschritte für die Laufanimation der NEON-KOMBAT-Kämpfer erzeugen.

Die Arcade-Sätze haben nur zwei Schrittbilder (Beine weit auseinander). Allein im Wechsel wirkt das wie
Gleiten mit zuckenden Beinen, mit den Stehbildern dazwischen wie Humpeln. Diese Skript setzt für jeden
Kämpfer zwei "Passing"-Bilder zusammen: Oberkörper aus dem Schrittbild (nach vorn geneigt), Beine aus
der Bereitpose (geschlossen unter dem Körper), an der Hüfte aneinandergefügt. Laufzyklus:
Schritt A → Zwischenschritt A → Schritt B → Zwischenschritt B.

Ergebnis: app/assets/arcade/fighters-<n>.png als zusätzliches Blatt, Bilder 16 und 17 je Kämpfer im
Manifest. Wird von build_arcade.py am Ende aufgerufen; kann auch einzeln laufen:  python3 tools/build_walk.py
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "app" / "assets"
SEAM = 0.55  # Naht auf 55 % der Körperhöhe (von oben)
PASS = (16, 17)


def opaque_top(img):
    a = img.getchannel("A").load()
    w, h = img.size
    return next((y for y in range(h) if any(a[x, y] > 128 for x in range(w))), 0)


def row_center(img, y):
    a = img.getchannel("A").load()
    xs = [x for x in range(img.size[0]) if a[x, y] > 128]
    return sum(xs) / len(xs) if xs else img.size[0] / 2


def torso_x(img, ax, ay):
    a = img.getchannel("A").load()
    w, h = img.size
    top = opaque_top(img)
    body = max(1.0, ay - top)
    sx = n = 0
    for y in range(int(top + body * 0.3), int(top + body * 0.6)):
        for x in range(w):
            if a[x, y] > 128:
                sx += x; n += 1
    return round(sx / n - ax, 1) if n else 0.0


def compose(step, sa, ready, ra):
    """Oberkörper von step über die Beine von ready; Rückgabe (Bild, Anker)."""
    syw = int(opaque_top(step) + (sa[1] - opaque_top(step)) * SEAM)
    syr = int(opaque_top(ready) + (ra[1] - opaque_top(ready)) * SEAM)
    dx = (row_center(ready, syr) - ra[0]) - (row_center(step, syw) - sa[0])
    dy = (syr - ra[1]) - (syw - sa[1])
    W, H = 400, 400
    ox, oy = 200, 330
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    legs = ready.crop((0, syr, ready.size[0], ready.size[1]))
    canvas.alpha_composite(legs, (int(round(ox - ra[0])), int(round(oy - ra[1] + syr))))
    upper = step.crop((0, 0, step.size[0], syw + 1))
    canvas.alpha_composite(upper, (int(round(ox - sa[0] + dx)), int(round(oy - sa[1] + dy))))
    box = canvas.getbbox()
    img = canvas.crop(box)
    return img, [round(ox - box[0], 1), round(oy - box[1], 1)]


def main():
    manifest = json.loads((OUT / "manifest.json").read_text())
    A = manifest["arcade"]
    base_sheets = A.get("baseSheets", A["sheets"])
    sheets = {}

    def crop(f):
        s = f["s"]
        if s not in sheets:
            sheets[s] = Image.open(OUT / "arcade" / f"fighters-{s}.png").convert("RGBA")
        x, y, w, h = f["r"]
        return sheets[s].crop((x, y, x + w, y + h))

    made = []
    for fid, F in A["fighters"].items():
        fr = F["frames"]
        ready, ra = crop(fr[0]), fr[0]["a"]
        for k, step_i in zip(PASS, (2, 3)):
            img, anchor = compose(crop(fr[step_i]), fr[step_i]["a"], ready, ra)
            made.append((fid, k, img, anchor))

    # einfach zeilenweise packen
    sheet_w, pad = 2048, 2
    x = y = row_h = 0
    places = []
    for fid, k, img, anchor in made:
        if x + img.width > sheet_w:
            x, y, row_h = 0, y + row_h + pad, 0
        places.append((fid, k, img, anchor, x, y))
        x += img.width + pad
        row_h = max(row_h, img.height)
    sheet = Image.new("RGBA", (sheet_w, y + row_h), (0, 0, 0, 0))
    idx = base_sheets
    for fid, k, img, anchor, px, py in places:
        sheet.alpha_composite(img, (px, py))
        frames = A["fighters"][fid]["frames"]
        while len(frames) <= k:
            frames.append(None)
        frames[k] = {"s": idx, "r": [px, py, img.width, img.height], "a": anchor, "t": torso_x(img, anchor[0], anchor[1])}
    sheet.save(OUT / "arcade" / f"fighters-{idx}.png", optimize=True)
    A["baseSheets"] = base_sheets
    A["sheets"] = base_sheets + 1
    poses = A.get("poses", [])
    A["poses"] = poses[:16] + ["pass_a", "pass_b"]
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    (OUT / "manifest.js").write_text("window.PET_MANIFEST = " + json.dumps(manifest, ensure_ascii=False) + ";\n")
    print(f"Zwischenschritte: {len(made)} Bilder für {len(A['fighters'])} Kämpfer in fighters-{idx}.png")


if __name__ == "__main__":
    main()
