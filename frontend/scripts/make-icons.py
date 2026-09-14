#!/usr/bin/env python3
"""Draws the installed-app icons into public/.

Run it when the mark changes:

    python3 scripts/make-icons.py

Kept as a script rather than four checked-in binaries nobody can edit: the
shapes and colours below are the source, the PNGs are the build.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "public"

FELT = (14, 49, 56)
FELT_LIT = (23, 74, 82)
CARD = (200, 52, 47)
CARD_EDGE = (244, 236, 220)
INK = (255, 255, 255)

FONT = "/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf"
# Every platform that renders a maskable icon may crop to a circle, so nothing
# that matters is allowed outside the middle 80%.
SAFE = 0.8


def rounded(size, radius, fill):
    """A rounded rectangle on its own transparent layer."""
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(
        (0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=fill
    )
    return layer


def draw_icon(px, *, maskable=False, opaque_square=False):
    scale = 4  # Drawn large and resampled down, so the edges stay clean.
    n = px * scale
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # The table: felt, with the light falling on the far side of it.
    if opaque_square:
        draw.rectangle((0, 0, n, n), fill=FELT)
    else:
        draw.rounded_rectangle((0, 0, n - 1, n - 1), radius=int(n * 0.22), fill=FELT)
    draw.ellipse(
        (-n * 0.25, -n * 0.55, n * 1.25, n * 0.62),
        fill=FELT_LIT,
    )
    if not opaque_square:
        # Trim the glow back inside the rounded corners.
        mask = Image.new("L", (n, n), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            (0, 0, n - 1, n - 1), radius=int(n * 0.22), fill=255
        )
        img.putalpha(mask)

    # The card, drawn flat and then tilted, the way one lands on a table.
    room = SAFE if maskable else 0.94
    cw, ch = int(n * 0.50 * room), int(n * 0.70 * room)
    card = rounded((cw, ch), int(cw * 0.12), CARD)
    edge = ImageDraw.Draw(card)
    inset = int(cw * 0.07)
    edge.rounded_rectangle(
        (inset, inset, cw - inset - 1, ch - inset - 1),
        radius=int(cw * 0.08),
        outline=CARD_EDGE,
        width=max(2, int(cw * 0.035)),
    )

    font = ImageFont.truetype(FONT, int(cw * 0.245))
    text = "DEAL"
    box = edge.textbbox((0, 0), text, font=font)
    edge.text(
        ((cw - (box[2] - box[0])) / 2 - box[0], (ch - (box[3] - box[1])) / 2 - box[1]),
        text,
        font=font,
        fill=INK,
    )

    card = card.rotate(9, resample=Image.BICUBIC, expand=True)
    img.alpha_composite(card, ((n - card.width) // 2, (n - card.height) // 2))

    return img.resize((px, px), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = [
        ("icon-192.png", draw_icon(192)),
        ("icon-512.png", draw_icon(512)),
        ("icon-maskable-512.png", draw_icon(512, maskable=True, opaque_square=True)),
        # iOS rounds this itself and puts no background behind it, so it ships
        # square and fully opaque.
        ("apple-touch-icon.png", draw_icon(180, opaque_square=True)),
    ]
    for name, image in jobs:
        if name == "apple-touch-icon.png" or name.startswith("icon-maskable"):
            image = image.convert("RGB")
        image.save(OUT / name)
        print(f"wrote {name}")


if __name__ == "__main__":
    main()
