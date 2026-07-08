import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { LegendItem } from "../chart/chartProjection";
import { CustomLegend } from "./CustomLegend";

describe("CustomLegend", () => {
  it("renders line and marker samples from resolved legend items", () => {
    const items: LegendItem[] = [
      {
        curveId: "curve-a",
        label: "No marker solid",
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
        lineWidth: 2.25
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

    const { container } = render(<CustomLegend items={items} />);

    expect(screen.getByRole("region", { name: "Custom legend" })).toBeInTheDocument();
    expect(container.querySelector('[data-line-type="dashed"] line')?.getAttribute("stroke-dasharray")).toBe("8 5");
    expect(container.querySelector('[data-line-type="dotted"] line')?.getAttribute("stroke-dasharray")).toBe("1 5");
    expect(container.querySelector('[data-marker-type="none"] [data-marker-symbol]')).toBeNull();
    expect(container.querySelector('[data-marker-symbol="circle"]')).toBeInTheDocument();
    expect(container.querySelector('[data-marker-symbol="triangle"]')).toBeInTheDocument();
  });

  it("reports hover and keyboard focus by curveId", async () => {
    const user = userEvent.setup();
    const hoveredCurveIds: Array<string | null> = [];
    const items: LegendItem[] = [
      {
        curveId: "curve-a",
        label: "A1 / S1",
        color: "#0b6fa4",
        lineType: "solid",
        markerType: "none",
        lineWidth: 2.25
      }
    ];

    render(<CustomLegend items={items} highlightedCurveId="curve-a" onHoverCurve={(curveId) => hoveredCurveIds.push(curveId)} />);

    const item = screen.getByText("A1 / S1").closest("li");
    expect(item).toHaveClass("custom-legend-item-active");
    await user.hover(item!);
    await user.unhover(item!);
    item?.focus();
    item?.blur();

    expect(hoveredCurveIds).toEqual(["curve-a", null, "curve-a", null]);
  });
});
