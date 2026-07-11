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
        label: "Assay 1 │ Synthetic Sample 1",
        color: "#0b6fa4",
        lineType: "solid",
        markerType: "none",
        lineWidth: 2.25
      }
    ];

    render(<CustomLegend items={items} highlightedCurveId="curve-a" onHoverCurve={(curveId) => hoveredCurveIds.push(curveId)} />);

    const item = screen.getByTitle("Assay 1 │ Synthetic Sample 1").closest("li");
    expect(item).toHaveClass("custom-legend-item-active");
    await user.hover(item!);
    await user.unhover(item!);
    item?.focus();
    item?.blur();

    expect(hoveredCurveIds).toEqual(["curve-a", null, "curve-a", null]);
  });

  it("preserves distinguishing suffixes and warns with source evidence when labels still collide", () => {
    const items: LegendItem[] = [
      {
        curveId: "curve-a",
        label: "Condition Alpha concentration with distinguishing Lot A",
        sourceIdentity: "source-1 / Sheet1 / A",
        color: "#7030a0",
        lineType: "dashed",
        markerType: "circle",
        lineWidth: 2.25
      },
      {
        curveId: "curve-b",
        label: "Condition Alpha concentration with distinguishing Lot B",
        sourceIdentity: "source-2 / Sheet1 / B",
        color: "#0926fb",
        lineType: "dotted",
        markerType: "rect",
        lineWidth: 2.25
      }
    ];
    const { rerender } = render(<CustomLegend items={items} />);

    expect(screen.getByText(/Lot A/u)).toBeVisible();
    expect(screen.getByText(/Lot B/u)).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerender(<CustomLegend items={items.map((item) => ({ ...item, label: "Condition Shared Final Label" }))} />);
    expect(screen.getByRole("alert")).toHaveTextContent("source-1 / Sheet1 / A");
    expect(screen.getByRole("alert")).toHaveTextContent("source-2 / Sheet1 / B");
  });
});
