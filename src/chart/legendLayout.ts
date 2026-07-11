import type { LegendItem } from "./chartProjection";

export type LegendTextMeasurer = (text: string) => number;

export type LaidOutLegendItem = {
  item: LegendItem;
  lines: string[];
  renderedLabel: string;
  truncated: boolean;
};

export type LegendIdentityCollision = {
  renderedLabel: string;
  curveIds: string[];
  sourceIdentities: string[];
};

export type LegendLayoutResult = {
  items: LaidOutLegendItem[];
  collisions: LegendIdentityCollision[];
};

export class LegendIdentityCollisionError extends Error {
  readonly collisions: LegendIdentityCollision[];

  constructor(collisions: LegendIdentityCollision[]) {
    const affected = collisions
      .flatMap((collision) => collision.sourceIdentities)
      .slice(0, 4)
      .join(", ");
    super(`Legend labels are not distinguishable at this output size (${affected}). Use shorter Analysis labels or Plot only.`);
    this.name = "LegendIdentityCollisionError";
    this.collisions = collisions;
  }
}

export function layoutLegendItems(args: {
  items: LegendItem[];
  maxTextWidth: number;
  font: string;
  measureText?: LegendTextMeasurer;
}): LegendLayoutResult {
  const measureText = args.measureText ?? createLegendTextMeasurer(args.font);
  const maxTextWidth = Math.max(12, args.maxTextWidth);
  const items = args.items.map((item) => {
    const layout = layoutLegendLabel(item.label, maxTextWidth, measureText);
    return {
      item,
      lines: layout.lines,
      renderedLabel: layout.lines.join("\n"),
      truncated: layout.truncated
    };
  });

  return {
    items,
    collisions: findLegendIdentityCollisions(items)
  };
}

export function assertLegendIdentity(layout: LegendLayoutResult) {
  if (layout.collisions.length > 0) throw new LegendIdentityCollisionError(layout.collisions);
}

export function assertLegendLabelsUnique(items: LegendItem[]) {
  const layout = layoutLegendItems({
    items,
    maxTextWidth: Number.MAX_SAFE_INTEGER,
    font: "12px Arial, sans-serif",
    measureText: (text) => text.length
  });
  assertLegendIdentity(layout);
}

export function layoutLegendLabel(label: string, maxWidth: number, measureText: LegendTextMeasurer) {
  const normalized = normalizeVisibleLabel(label);
  if (measureText(normalized) <= maxWidth) return { lines: [normalized], truncated: false };

  const semanticParts = splitSemanticIdentity(normalized);
  if (semanticParts) {
    const first = fitLineMiddle(semanticParts[0], maxWidth, measureText);
    const second = fitLineMiddle(semanticParts[1], maxWidth, measureText);
    return {
      lines: [first.text, second.text],
      truncated: first.truncated || second.truncated
    };
  }

  const words = normalized.split(" ").filter(Boolean);
  let best: { first: string; second: string; balance: number } | null = null;
  for (let index = 1; index < words.length; index += 1) {
    const first = words.slice(0, index).join(" ");
    const second = words.slice(index).join(" ");
    const firstWidth = measureText(first);
    const secondWidth = measureText(second);
    if (firstWidth > maxWidth || secondWidth > maxWidth) continue;
    const balance = Math.abs(firstWidth - secondWidth);
    if (!best || balance < best.balance) best = { first, second, balance };
  }
  if (best) return { lines: [best.first, best.second], truncated: false };

  const first = fitLineEnd(normalized, maxWidth, measureText);
  const second = fitLineStart(normalized, maxWidth, measureText);
  return { lines: [first.text, second.text], truncated: true };
}

function fitLineMiddle(text: string, maxWidth: number, measureText: LegendTextMeasurer) {
  if (measureText(text) <= maxWidth) return { text, truncated: false };
  const characters = Array.from(text);
  const ellipsis = "...";
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const prefixLength = Math.ceil(middle * 0.55);
    const suffixLength = middle - prefixLength;
    const suffix = suffixLength > 0 ? characters.slice(-suffixLength).join("") : "";
    const candidate = `${characters.slice(0, prefixLength).join("")}${ellipsis}${suffix}`;
    if (measureText(candidate) <= maxWidth) low = middle;
    else high = middle - 1;
  }
  const prefixLength = Math.ceil(low * 0.55);
  const suffixLength = low - prefixLength;
  const suffix = suffixLength > 0 ? characters.slice(-suffixLength).join("") : "";
  return {
    text: `${characters.slice(0, prefixLength).join("")}${ellipsis}${suffix}`,
    truncated: true
  };
}

export function createLegendTextMeasurer(font: string): LegendTextMeasurer {
  if (typeof document !== "undefined" && !globalThis.navigator?.userAgent?.toLowerCase().includes("jsdom")) {
    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (context) {
        context.font = font;
        return (text) => context.measureText(text).width;
      }
    } catch {
      // Fall through to a deterministic conservative estimate.
    }
  }

  const fontSize = Number(font.match(/([0-9]+(?:\.[0-9]+)?)px/u)?.[1]) || 12;
  return (text) =>
    Array.from(text).reduce((width, character) => {
      if (/\s/u.test(character)) return width + fontSize * 0.34;
      if (/^[\u0000-\u00ff]$/u.test(character)) return width + fontSize * 0.58;
      return width + fontSize;
    }, 0);
}

function splitSemanticIdentity(label: string): [string, string] | null {
  const sourceSuffix = label.match(/^(.*?)(\s+\[[^\]]+\])$/u);
  if (sourceSuffix?.[1] && sourceSuffix[2]) return [sourceSuffix[1], sourceSuffix[2].trimStart()];

  const separators = [" │ ", " ｜ ", " | "];
  for (const separator of separators) {
    const index = label.lastIndexOf(separator);
    if (index > 0 && index + separator.length < label.length) {
      return [label.slice(0, index), label.slice(index + 1).trimStart()];
    }
  }
  return null;
}

function fitLineEnd(text: string, maxWidth: number, measureText: LegendTextMeasurer) {
  if (measureText(text) <= maxWidth) return { text, truncated: false };
  const ellipsis = "...";
  const characters = Array.from(text);
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (measureText(`${characters.slice(0, middle).join("")}${ellipsis}`) <= maxWidth) low = middle;
    else high = middle - 1;
  }
  return { text: `${characters.slice(0, low).join("")}${ellipsis}`, truncated: true };
}

function fitLineStart(text: string, maxWidth: number, measureText: LegendTextMeasurer) {
  if (measureText(text) <= maxWidth) return { text, truncated: false };
  const ellipsis = "...";
  const characters = Array.from(text);
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (measureText(`${ellipsis}${characters.slice(-middle).join("")}`) <= maxWidth) low = middle;
    else high = middle - 1;
  }
  const suffix = low > 0 ? characters.slice(-low).join("") : "";
  return { text: `${ellipsis}${suffix}`, truncated: true };
}

function findLegendIdentityCollisions(items: LaidOutLegendItem[]) {
  const byLabel = new Map<string, LaidOutLegendItem[]>();
  for (const item of items) {
    const group = byLabel.get(item.renderedLabel) ?? [];
    group.push(item);
    byLabel.set(item.renderedLabel, group);
  }

  return [...byLabel.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([renderedLabel, group]) => ({
      renderedLabel,
      curveIds: group.map(({ item }) => item.curveId),
      sourceIdentities: group.map(({ item }) => {
        const source = item.sourceIdentity || item.sourceSuffix;
        return source ? `${source} (${item.curveId})` : item.curveId;
      })
    }));
}

function normalizeVisibleLabel(label: string) {
  return label.replaceAll(/\s+/gu, " ").trim() || "Empty label";
}
