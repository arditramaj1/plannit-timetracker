import colorsys


def hsl_to_hex(hue: int, saturation: int, lightness: int) -> str:
    red, green, blue = colorsys.hls_to_rgb(
        ((hue % 360) + 360) % 360 / 360,
        lightness / 100,
        saturation / 100,
    )
    return "#{:02X}{:02X}{:02X}".format(
        round(red * 255),
        round(green * 255),
        round(blue * 255),
    )


def get_saturated_pastel_project_colors() -> list[str]:
    return [
        hsl_to_hex(index * 15, 72, 72 if index % 2 == 0 else 68)
        for index in range(24)
    ]
