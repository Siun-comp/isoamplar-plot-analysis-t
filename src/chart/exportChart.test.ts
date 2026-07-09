import { describe, expect, it } from "vitest";
import type { LegendItem } from "./chartProjection";
import { calculateLegendImageSize, createLegendSvg, createReportLegendExcelClipboardPayload, dataUrlToBlob } from "./exportChart";

describe("chart export helpers", () => {
  it("creates a legend SVG with line and marker samples", () => {
    const items: LegendItem[] = [
      {
        curveId: "curve-a",
        label: "A & B",
        color: "#0b6fa4",
        lineType: "solid",
        markerType: "none",
        lineWidth: 2.25
      },
      {
        curveId: "curve-b",
        label: "Dashed circle",
        color: "#d97706",
        lineType: "dashed",
        markerType: "circle",
        lineWidth: 3
      },
      {
        curveId: "curve-c",
        label: "Dotted triangle",
        color: "#5b8c5a",
        lineType: "dotted",
        markerType: "triangle",
        lineWidth: 2.25
      }
    ];
    const size = calculateLegendImageSize(items, 800);
    const svg = createLegendSvg(items, size.width, size.height);

    expect(size.height).toBeGreaterThan(58);
    expect(svg).toContain("A &amp; B");
    expect(svg).toContain('stroke-dasharray="8 5"');
    expect(svg).toContain('stroke-dasharray="1 5"');
    expect(svg).toContain("<circle");
    expect(svg).toContain("<polygon");
    expect(svg.match(/<(circle|polygon) /gu)).toHaveLength(2);
  });

  it("creates a report legend SVG with larger readable rows", () => {
    const items: LegendItem[] = [
      {
        curveId: "curve-a",
        label: "RSV A_15 | 7/8_old",
        color: "#0b6fa4",
        lineType: "solid",
        markerType: "none",
        lineWidth: 2.25
      },
      {
        curveId: "curve-b",
        label: "RSV A_20 | 7/8_new very long label segment",
        color: "#d97706",
        lineType: "dashed",
        markerType: "circle",
        lineWidth: 2.25
      },
      {
        curveId: "curve-c",
        label: "RSV B_25 | 7/8_old",
        color: "#5b8c5a",
        lineType: "dotted",
        markerType: "triangle",
        lineWidth: 3
      },
      {
        curveId: "curve-d",
        label: "RSV B_31 | 7/8_new",
        color: "#b23a48",
        lineType: "solid",
        markerType: "rect",
        lineWidth: 2.25
      },
      {
        curveId: "curve-e",
        label: "RSV B_39 | 7/8_old",
        color: "#6f5fa8",
        lineType: "solid",
        markerType: "none",
        lineWidth: 2.25
      }
    ];
    const size = calculateLegendImageSize(items, 900, "report");
    const svg = createLegendSvg(items, size.width, size.height, "report");

    expect(size).toEqual({ width: 900, height: 270 });
    expect(svg).toContain('font-size="22"');
    expect(svg).toContain('stroke-width="3.5"');
    expect(svg).toContain("<tspan");
    expect(svg).toContain("<rect");
  });

  it("creates rich Excel clipboard payload for report legend cells", () => {
    const items: LegendItem[] = [
      {
        curveId: "curve-a",
        label: "=A1 label",
        color: "#0b6fa4",
        lineType: "dashed",
        markerType: "circle",
        lineWidth: 2.25
      }
    ];
    const payload = createReportLegendExcelClipboardPayload({ title: "Legend - Specimen: S1", items });

    expect(payload.html).toContain("<table");
    expect(payload.html).toContain("Style");
    expect(payload.html).toContain("Name");
    expect(payload.html).toContain("Malgun Gothic");
    expect(payload.html).toContain("font-size:9pt");
    expect(payload.html).toContain("color:#0b6fa4");
    expect(payload.html).toContain("&#9679;");
    expect(payload.html).toContain("&#9472;&#9472;&nbsp;&nbsp;&#9679;&nbsp;&nbsp;&#9472;&#9472;");
    expect(payload.html).toContain("&#8203;=A1 label");
    expect(payload.text.split("\r\n")).toEqual(["Legend - Specimen: S1", "Style\tName", "dashed, circle, #0b6fa4\t\u200B=A1 label"]);
  });

  it("converts base64 image data URLs to typed blobs", async () => {
    const blob = dataUrlToBlob("data:image/png;base64,AAAA");
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(3);
  });

  it("rejects empty or non-image export data URLs", () => {
    expect(() => dataUrlToBlob("data:,")).toThrow("Image export failed.");
    expect(() => dataUrlToBlob("data:text/plain;base64,AAAA")).toThrow("Image export failed.");
  });
});
