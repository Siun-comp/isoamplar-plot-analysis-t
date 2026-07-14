import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { calculateThresholdResult } from "../analysis/threshold";
import type { LegendItem } from "../chart/chartProjection";
import * as thresholdClipboard from "../chart/thresholdClipboard";
import { createStats, createSyntheticPcrDataset } from "../data/sampleData";
import type { Curve, PcrWarning } from "../data/types";
import { ThresholdResultsPanel } from "./ThresholdResultsPanel";

describe("ThresholdResultsPanel", () => {
  it("shows auditable event evidence and keeps multiple crossings in the review filter", async () => {
    const user = userEvent.setup();
    const copySpy = vi
      .spyOn(thresholdClipboard, "copyThresholdResultsExcelTableToClipboard")
      .mockResolvedValue(undefined);
    const base = createSyntheticPcrDataset({
      specimenLabels: ["Synthetic specimen"],
      reagentLabels: ["Synthetic assay"],
      cycleCount: 4
    }).curves[0];
    const formulaCell = `${base.source.columnLetter}4`;
    const warning: PcrWarning = {
      code: "FORMULA_CACHED_VALUE_USED",
      severity: "warning",
      scope: "cell",
      message: "Synthetic cached formula evidence",
      curveIds: [base.curveId],
      sourceRefs: [
        {
          sourceInstanceId: "synthetic-source-01",
          sourceKind: "excel",
          sourceName: "synthetic-threshold.xlsx",
          worksheet: "SyntheticData",
          cell: formulaCell,
          columnLetter: base.source.columnLetter,
          formulaCacheStatus: "used"
        }
      ]
    };
    const curve: Curve = {
      ...base,
      y: [1, 6, 1, 7],
      stats: createStats([1, 6, 1, 7]),
      source: {
        ...base.source,
        sourceKind: "excel",
        sourceInstanceId: "synthetic-source-01",
        fileName: "synthetic-threshold.xlsx",
        sheetName: "SyntheticData"
      },
      warnings: [warning]
    };
    const result = calculateThresholdResult(curve, 5);
    const legend: LegendItem = {
      curveId: curve.curveId,
      label: "Synthetic assay",
      color: "#0926fb",
      lineType: "solid",
      markerType: "none",
      lineWidth: 2.25
    };

    render(
      <ThresholdResultsPanel
        enabled
        threshold={5}
        curves={[curve]}
        results={[result]}
        legendItems={[legend]}
        onHoverCurve={vi.fn()}
      />
    );

    await user.click(screen.getByText("Threshold 값 검토"));
    const filter = screen.getByRole("combobox", { name: "Threshold 결과 상태 필터" });
    await user.selectOptions(filter, "review");
    const resultRow = screen.getByText("Synthetic assay").closest("details");
    expect(resultRow).toHaveClass("threshold-result-row");

    await user.click(within(resultRow as HTMLElement).getByText("Synthetic assay"));
    const evidence = screen.getByRole("list", { name: "Synthetic assay Threshold event 근거" });
    expect(evidence).toHaveTextContent("Event 1 · 상승 교차 · 주 결과");
    expect(evidence).toHaveTextContent("좌측 원시점: index 0 · Cycle 1 · fluorescence 1");
    expect(evidence).toHaveTextContent(`우측 원시점: index 1 · Cycle 2 · fluorescence 6 · ${formulaCell}`);
    expect(evidence).toHaveTextContent("Cycle-axis 추정: C1.8 · 보간 상태 유효");
    expect(evidence).toHaveTextContent("수식 캐시 근거: 사용됨");
    expect(evidence).toHaveTextContent("synthetic-source-01 · synthetic-threshold.xlsx · SyntheticData");
    expect(screen.getByText(/상승 교차 후보: 2 \(다중 교차 검토\)/u)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "현재 표시된 Threshold 결과를 Excel 표로 복사" }));
    expect(copySpy).toHaveBeenCalledWith({ curves: [curve], results: [result] });
    expect(screen.getByRole("status")).toHaveTextContent("1개 결과를 복사했습니다.");

    await user.selectOptions(filter, "not-reached");
    expect(screen.getByRole("button", { name: "현재 표시된 Threshold 결과를 Excel 표로 복사" })).toBeDisabled();
  });
});
