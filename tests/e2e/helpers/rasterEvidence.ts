import type { Page } from "@playwright/test";

export type RasterEvidence = {
  width: number;
  height: number;
  sampledPixels: number;
  nonWhitePixels: number;
  whiteCornerPixels: number;
  transparentPixels: number;
  perimeterPixels: number;
  whitePerimeterPixels: number;
  nonWhiteBounds: EvidenceBounds | null;
};

export type EvidenceBounds = {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type RasterRegionProbe = EvidenceBounds & { expectedColor?: string };
export type RasterRegionEvidence = {
  id: string;
  pixels: number;
  nonWhitePixels: number;
  expectedColorPixels: number;
};

export async function inspectRasterDataUrl(page: Page, dataUrl: string): Promise<RasterEvidence> {
  return page.evaluate(async (source) => {
    const image = new Image();
    image.src = source;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas 2D context is unavailable.");
    context.drawImage(image, 0, 0);

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const stride = Math.max(1, Math.floor((canvas.width * canvas.height) / 100_000));
    let sampledPixels = 0;
    let nonWhitePixels = 0;
    let transparentPixels = 0;
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = -1;
    let maxY = -1;
    for (let pixel = 0; pixel < canvas.width * canvas.height; pixel += 1) {
      const index = pixel * 4;
      const alpha = pixels[index + 3];
      if (alpha !== 255) transparentPixels += 1;
      const white = alpha === 255 && pixels[index] >= 250 && pixels[index + 1] >= 250 && pixels[index + 2] >= 250;
      if (!white && alpha > 0) {
        const x = pixel % canvas.width;
        const y = Math.floor(pixel / canvas.width);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      if (pixel % stride !== 0) continue;
      sampledPixels += 1;
      if (!white) nonWhitePixels += 1;
    }

    const corners = [
      [0, 0],
      [Math.max(0, canvas.width - 1), 0],
      [0, Math.max(0, canvas.height - 1)],
      [Math.max(0, canvas.width - 1), Math.max(0, canvas.height - 1)]
    ];
    const whiteCornerPixels = corners.filter(([x, y]) => {
      const data = context.getImageData(x, y, 1, 1).data;
      return data[0] >= 250 && data[1] >= 250 && data[2] >= 250 && data[3] === 255;
    }).length;
    const perimeter = new Set<number>();
    for (let x = 0; x < canvas.width; x += 1) {
      perimeter.add(x);
      perimeter.add((canvas.height - 1) * canvas.width + x);
    }
    for (let y = 0; y < canvas.height; y += 1) {
      perimeter.add(y * canvas.width);
      perimeter.add(y * canvas.width + canvas.width - 1);
    }
    const whitePerimeterPixels = [...perimeter].filter((pixel) => {
      const index = pixel * 4;
      return pixels[index] >= 250 && pixels[index + 1] >= 250 && pixels[index + 2] >= 250 && pixels[index + 3] === 255;
    }).length;

    return {
      width: canvas.width,
      height: canvas.height,
      sampledPixels,
      nonWhitePixels,
      whiteCornerPixels,
      transparentPixels,
      perimeterPixels: perimeter.size,
      whitePerimeterPixels,
      nonWhiteBounds:
        maxX >= minX && maxY >= minY
          ? { id: "non-white-content", left: minX, top: minY, right: maxX + 1, bottom: maxY + 1 }
          : null
    };
  }, dataUrl);
}

export async function inspectRasterRegions(
  page: Page,
  dataUrl: string,
  regions: RasterRegionProbe[]
): Promise<RasterRegionEvidence[]> {
  return page.evaluate(async ({ source, probes }) => {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas 2D context is unavailable.");
    context.drawImage(image, 0, 0);

    return probes.map((probe) => {
      const left = Math.max(0, Math.floor(probe.left));
      const top = Math.max(0, Math.floor(probe.top));
      const right = Math.min(canvas.width, Math.ceil(probe.right));
      const bottom = Math.min(canvas.height, Math.ceil(probe.bottom));
      const expected = probe.expectedColor ? parseHex(probe.expectedColor) : null;
      let pixels = 0;
      let nonWhitePixels = 0;
      let expectedColorPixels = 0;
      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
          const data = context.getImageData(x, y, 1, 1).data;
          pixels += 1;
          if (!(data[3] === 255 && data[0] >= 250 && data[1] >= 250 && data[2] >= 250)) nonWhitePixels += 1;
          if (
            expected &&
            Math.abs(data[0] - expected[0]) <= 12 &&
            Math.abs(data[1] - expected[1]) <= 12 &&
            Math.abs(data[2] - expected[2]) <= 12 &&
            data[3] === 255
          ) {
            expectedColorPixels += 1;
          }
        }
      }
      return { id: probe.id, pixels, nonWhitePixels, expectedColorPixels };
    });

    function parseHex(value: string) {
      const normalized = value.replace(/^#/u, "");
      return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16));
    }
  }, { source: dataUrl, probes: regions });
}

export function findOverlappingBounds(bounds: EvidenceBounds[]) {
  const collisions: Array<[string, string]> = [];

  for (let leftIndex = 0; leftIndex < bounds.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < bounds.length; rightIndex += 1) {
      const left = bounds[leftIndex];
      const right = bounds[rightIndex];
      if (
        left.left < right.right &&
        left.right > right.left &&
        left.top < right.bottom &&
        left.bottom > right.top
      ) {
        collisions.push([left.id, right.id]);
      }
    }
  }

  return collisions;
}
