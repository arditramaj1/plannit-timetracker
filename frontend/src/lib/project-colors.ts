function clampColorChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const normalizedHue = ((hue % 360) + 360) % 360;
  const normalizedSaturation = saturation / 100;
  const normalizedLightness = lightness / 100;

  const chroma =
    (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation;
  const huePrime = normalizedHue / 60;
  const secondComponent = chroma * (1 - Math.abs((huePrime % 2) - 1));

  let red = 0;
  let green = 0;
  let blue = 0;

  if (huePrime >= 0 && huePrime < 1) {
    red = chroma;
    green = secondComponent;
  } else if (huePrime >= 1 && huePrime < 2) {
    red = secondComponent;
    green = chroma;
  } else if (huePrime >= 2 && huePrime < 3) {
    green = chroma;
    blue = secondComponent;
  } else if (huePrime >= 3 && huePrime < 4) {
    green = secondComponent;
    blue = chroma;
  } else if (huePrime >= 4 && huePrime < 5) {
    red = secondComponent;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondComponent;
  }

  const lightnessMatch = normalizedLightness - chroma / 2;
  const rgb = [red, green, blue]
    .map((channel) => clampColorChannel((channel + lightnessMatch) * 255))
    .map((channel) => channel.toString(16).padStart(2, "0").toUpperCase())
    .join("");

  return `#${rgb}`;
}

export function getSaturatedPastelProjectColors() {
  return Array.from({ length: 24 }, (_, index) =>
    hslToHex(index * 15, 72, index % 2 === 0 ? 72 : 68),
  );
}
