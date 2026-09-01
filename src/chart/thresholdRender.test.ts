import { describe, expect, it, vi } from "vitest";
import type { EChartsCoreOption } from "echarts/core";
import { createDefaultThresholdSettings, THRESHOLD_RULE_ID } from "../analysis/threshold";
import { createSyntheticPcrDataset } from "../data/sampleData";
import {
  applyRenderedThresholdAnnotation,
  buildChartThresholdMarkers,
  createThresholdMarkLine,
  findThresholdValue,
  formatThresholdValue
} from "./thresholdRender";

function createOption(value = 5): EChartsCoreOption {
  return {
    grid: { top: 30, bottom: 54 },
    series: [
      {
        id: "curve-1",
        type: "line",
        data: [[1, 1], [2, 10]],
        markLine: createThresholdMarkLine({ value, ruleId: THRESHOLD_RULE_ID })
      }
    ]
  };
}

describe("Threshold chart rendering", () => {
  it("merges equal enabled reagent Thresholds into one neutral line", () => {
    const dataset = createSyntheticPcrDataset({
      specimenLabels: ["Synthetic"],
      reagentLabels: ["A", "B", "C"]
    });
    const settings = {
      ...createDefaultThresholdSettings(),
      mode: "perReagent" as const,
      reagentSettings: Object.fromEntries(dataset.reagents.map((reagent, index) => [
        reagent.id,
        {
          enabled: index < 2,
          draftValue: "5",
          applied: index < 2 ? { value: 5, ruleId: THRESHOLD_RULE_ID } : null
        }
      ]))
    };
    const markers = buildChartThresholdMarkers({
      curves: dataset.curves,
      reagents: dataset.reagents,
      settings
    });
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({ value: 5, color: "#4b5563" });
    expect(markers[0].label).toContain("A, B");
  });

  it("creates one silent no-symbol mark line and extracts its value", () => {
    const option = createOption(5);
    expect(findThresholdValue(option)).toBe(5);
    expect((option.series as Array<Record<string, unknown>>)[0]).toMatchObject({
      markLine: { silent: true, symbol: ["none", "none"], label: { formatter: "5" }, data: [{ yAxis: 5 }] }
    });
  });

  it("uses actual rendered pixel extent for line and outside annotations", () => {
    const setOption = vi.fn();
    const chart = {
      convertToPixel: vi.fn((_finder: object, value: number) => (value === 5 ? 200 : value === 20 ? 10 : 580)),
      getWidth: () => 800,
      getHeight: () => 600,
      setOption
    };
    expect(applyRenderedThresholdAnnotation(chart, createOption(5))).toBe("line");
    expect(applyRenderedThresholdAnnotation(chart, createOption(20))).toBe("above");
    expect(applyRenderedThresholdAnnotation(chart, createOption(-20))).toBe("below");
    expect(setOption).toHaveBeenCalledWith(expect.objectContaining({ graphic: expect.any(Array) }), expect.any(Object));
    setOption.mockClear();
    expect(applyRenderedThresholdAnnotation(chart, createOption(20), { rangeAnnotationFontSize: 36 })).toBe("above");
    expect(setOption).toHaveBeenCalledWith(
      expect.objectContaining({ graphic: [expect.objectContaining({ style: expect.objectContaining({ font: "36px Arial, sans-serif" }) })] }),
      expect.any(Object)
    );
  });

  it("renders distinct in-range reagent Thresholds on a collision-managed label rail", () => {
    const option = createOption();
    (option.series as Array<Record<string, unknown>>)[0].markLine = createThresholdMarkLine([
      { key: "reagent-a", label: "Assay A · 5", color: "#7030A0", value: 5, ruleId: THRESHOLD_RULE_ID },
      { key: "reagent-b", label: "Assay B · 5.1", color: "#0926FB", value: 5.1, ruleId: THRESHOLD_RULE_ID }
    ]);
    const setOption = vi.fn();
    const chart = {
      convertToPixel: vi.fn((_finder: object, value: number) => (value === 5 ? 200 : 202)),
      getWidth: () => 800,
      getHeight: () => 600,
      setOption
    };

    expect(applyRenderedThresholdAnnotation(chart, option)).toBe("line");
    const graphics = setOption.mock.calls[0][0].graphic as Array<{ id: string; top?: number }>;
    const labels = graphics.filter((graphic) => graphic.id.includes("rail-label"));
    expect(labels.map((label) => label.id)).toEqual([
      "isoamplar-threshold-range-annotation-rail-label-reagent-a",
      "isoamplar-threshold-range-annotation-rail-label-reagent-b"
    ]);
    expect((labels[1].top as number) - (labels[0].top as number)).toBeGreaterThanOrEqual(20);
  });

  it("keeps the applied value visible when a long reagent label is shortened on the rail", () => {
    const option = createOption();
    (option.series as Array<Record<string, unknown>>)[0].markLine = createThresholdMarkLine([
      { key: "long-a", label: "Synthetic assay condition with long distinguishing suffix A · 5", color: "#7030A0", value: 5, ruleId: THRESHOLD_RULE_ID },
      { key: "long-b", label: "Synthetic assay condition with long distinguishing suffix B · 5.1", color: "#0926FB", value: 5.1, ruleId: THRESHOLD_RULE_ID }
    ]);
    const setOption = vi.fn();
    const chart = {
      convertToPixel: vi.fn((_finder: object, value: number) => (value === 5 ? 200 : 230)),
      getWidth: () => 800,
      getHeight: () => 600,
      setOption
    };

    applyRenderedThresholdAnnotation(chart, option);
    const graphics = setOption.mock.calls[0][0].graphic as Array<{ id: string; style?: { text?: string } }>;
    const labelTexts = graphics
      .filter((graphic) => graphic.id.includes("rail-label"))
      .map((graphic) => graphic.style?.text);
    expect(labelTexts).toHaveLength(2);
    expect(labelTexts[0]).toMatch(/… · 5$/u);
    expect(labelTexts[1]).toMatch(/… · 5\.1$/u);
  });

  it("reports no-data instead of drawing a misleading Auto-scale line", () => {
    const option = createOption();
    (option.series as Array<Record<string, unknown>>)[0].data = [[1, null]];
    const chart = { convertToPixel: vi.fn(), getWidth: () => 800, getHeight: () => 600, setOption: vi.fn() };
    expect(applyRenderedThresholdAnnotation(chart, option)).toBe("no-data");
    expect(chart.convertToPixel).not.toHaveBeenCalled();
  });

  it("uses explicit Fixed bounds for all-null curves", () => {
    const option = createOption(5);
    (option.series as Array<Record<string, unknown>>)[0].data = [[1, null]];
    option.yAxis = { min: 0, max: 10 };
    const chart = {
      convertToPixel: vi.fn((_finder: object, value: number) => 30 + ((10 - value) / 10) * 516),
      getWidth: () => 800,
      getHeight: () => 600,
      setOption: vi.fn()
    };

    expect(applyRenderedThresholdAnnotation(chart, option)).toBe("line");
    expect(applyRenderedThresholdAnnotation(chart, createFixedNullOption(0))).toBe("line");
    expect(applyRenderedThresholdAnnotation(chart, createFixedNullOption(10))).toBe("line");
    expect(applyRenderedThresholdAnnotation(chart, createFixedNullOption(11))).toBe("above");
    expect(applyRenderedThresholdAnnotation(chart, createFixedNullOption(-1))).toBe("below");
  });

  it("falls back to rendered axis endpoints for extreme finite Thresholds", () => {
    const chart = {
      convertToPixel: vi.fn(() => Number.NEGATIVE_INFINITY),
      convertFromPixel: vi.fn((_finder: object, pixel: number) => (pixel === 30 ? 10 : 0)),
      getWidth: () => 800,
      getHeight: () => 600,
      setOption: vi.fn()
    };
    expect(applyRenderedThresholdAnnotation(chart, createOption(1e307))).toBe("above");
    expect(applyRenderedThresholdAnnotation(chart, createOption(-1e307))).toBe("below");
  });

  it("formats ordinary and extreme values without changing their numeric source", () => {
    expect(formatThresholdValue(1234.56789)).toBe("1234.568");
    expect(formatThresholdValue(1.2e7)).toBe("1.20000e+7");
  });
});

function createFixedNullOption(value: number): EChartsCoreOption {
  const option = createOption(value);
  option.yAxis = { min: 0, max: 10 };
  (option.series as Array<Record<string, unknown>>)[0].data = [[1, null]];
  return option;
}
