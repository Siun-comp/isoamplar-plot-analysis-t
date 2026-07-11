import { describe, expect, it } from "vitest";
import type { LegendItem } from "./chartProjection";
import { assertLegendIdentity, LegendIdentityCollisionError, layoutLegendItems } from "./legendLayout";

const measureTen = (text: string) => Array.from(text).length * 10;

describe("legend identity layout", () => {
  it("preserves distinguishing end segments within a measured two-line layout", () => {
    const layout = layoutLegendItems({
      items: [
        item("curve-a", "Condition Alpha concentration with distinguishing Lot A", "source-1"),
        item("curve-b", "Condition Alpha concentration with distinguishing Lot B", "source-2")
      ],
      maxTextWidth: 180,
      font: "12px Arial",
      measureText: measureTen
    });

    expect(layout.items.every((entry) => entry.lines.length <= 2)).toBe(true);
    expect(layout.items[0].renderedLabel).toContain("Lot A");
    expect(layout.items[1].renderedLabel).toContain("Lot B");
    expect(layout.items.flatMap((entry) => entry.lines).every((line) => measureTen(line) <= 180)).toBe(true);
    expect(layout.collisions).toEqual([]);
  });

  it("keeps Korean and slash-bearing secondary identity visible", () => {
    const layout = layoutLegendItems({
      items: [item("curve-a", "합성 검체/조건 │ 시약/농도 10 ng", "synthetic.xlsx / A")],
      maxTextWidth: 150,
      font: "12px Arial",
      measureText: measureTen
    });

    expect(layout.items[0].lines).toHaveLength(2);
    expect(layout.items[0].lines[1]).toContain("시약/농도");
  });

  it("reports unresolved final display collisions with curve and source identity", () => {
    const layout = layoutLegendItems({
      items: [
        item("curve-c", "Condition Shared Final Label", "source-1"),
        item("curve-d", "Condition Shared Final Label", "source-2")
      ],
      maxTextWidth: 200,
      font: "12px Arial",
      measureText: measureTen
    });

    expect(layout.collisions).toEqual([
      {
        renderedLabel: layout.items[0].renderedLabel,
        curveIds: ["curve-c", "curve-d"],
        sourceIdentities: ["source-1 (curve-c)", "source-2 (curve-d)"]
      }
    ]);
    expect(() => assertLegendIdentity(layout)).toThrow(LegendIdentityCollisionError);
    expect(() => assertLegendIdentity(layout)).toThrow(/source-1 \(curve-c\).*source-2 \(curve-d\)/u);
  });
});

function item(curveId: string, label: string, sourceSuffix: string): LegendItem {
  return {
    curveId,
    label,
    sourceSuffix,
    color: "#0926fb",
    lineType: "solid",
    markerType: "none",
    lineWidth: 2
  };
}
