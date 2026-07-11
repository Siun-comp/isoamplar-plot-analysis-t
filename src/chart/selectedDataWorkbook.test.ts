import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { createDefaultChartScale } from "./chartScale";
import { createStats, createSyntheticPcrDataset } from "../data/sampleData";
import type { Curve, PcrWarning } from "../data/types";
import {
  createSelectedDataWorkbook,
  inspectSelectedDataWorkbookRole,
  SELECTED_DATA_ROLE_SHEET_NAME,
  SELECTED_DATA_WORKBOOK_MARKER,
  validateSelectedDataProjection
} from "./selectedDataWorkbook";

describe("Selected Data XLSX writer", () => {
  it("writes ordered raw numeric/null data, provenance sheets, and a hidden role marker", async () => {
    const dataset = createSyntheticPcrDataset({
      specimenLabels: ["Sample A"],
      reagentLabels: ["Assay 1", "Assay 2"],
      cycleCount: 3
    });
    const first = withValues(dataset.curves[0], [1.25, null, -3.5]);
    const second = withValues(dataset.curves[1], [9e-7, 2.5e6, 4]);
    const chartScale = createDefaultChartScale();
    chartScale.y.applied = { mode: "fixed", min: 0, max: 10 };

    const result = await createSelectedDataWorkbook({
      curves: [second, first],
      labelsByCurveId: new Map([
        [second.curveId, "Second"],
        [first.curveId, "First"]
      ]),
      analysisLabelsByCurveId: { [second.curveId]: "Condition B" },
      warnings: [],
      analysisName: "Synthetic analysis",
      chartScale,
      exportedAt: "2026-07-12T01:02:03.000Z"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const workbook = readWorkbook(result.buffer);
    expect(workbook.SheetNames).toEqual([
      "PlottedData",
      "CurveInfo",
      "Warnings",
      "ExportInfo",
      SELECTED_DATA_ROLE_SHEET_NAME
    ]);
    expect(inspectSelectedDataWorkbookRole(workbook)).toEqual({ kind: "selected-data", schemaVersion: 1 });
    expect(workbook.Workbook?.Sheets?.find((sheet) => sheet.name === SELECTED_DATA_ROLE_SHEET_NAME)?.Hidden).toBe(1);

    const plotted = workbook.Sheets.PlottedData;
    expect(plotted.A1.v).toBe("Cycle");
    expect(plotted.B1.v).toBe("Second");
    expect(plotted.C1.v).toBe("First");
    expect(plotted.B2).toMatchObject({ t: "n", v: 9e-7 });
    expect(plotted.C2).toMatchObject({ t: "n", v: 1.25 });
    expect(plotted.C3).toBeUndefined();
    expect(plotted.C4).toMatchObject({ t: "n", v: -3.5 });

    const curveInfo = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.CurveInfo, { header: 1, raw: true });
    expect(curveInfo[1]).toEqual(expect.arrayContaining([1, second.curveId, "Second", "Condition B", "Sample A", "Assay 2"]));
    expect(curveInfo[2]?.[1]).toBe(first.curveId);

    const exportInfo = keyValueRows(workbook.Sheets.ExportInfo);
    expect(exportInfo.get("Workbook marker")).toBe(SELECTED_DATA_WORKBOOK_MARKER);
    expect(exportInfo.get("Analysis name")).toBe("Synthetic analysis");
    expect(exportInfo.get("Y applied mode")).toBe("fixed");
    expect(exportInfo.get("Fluorescence transform")).toBe("None");
    expect(exportInfo.get("Exported rows")).toBe("Full common X range");
  });

  it("rejects empty, non-common-X, non-rectangular, and non-finite projections", async () => {
    const dataset = createSyntheticPcrDataset({
      specimenLabels: ["Sample"],
      reagentLabels: ["A", "B"],
      cycleCount: 3
    });
    const [first, second] = dataset.curves;

    expect(validateSelectedDataProjection([])).toMatchObject({ ok: false });
    expect(validateSelectedDataProjection([first, { ...second, x: [1, 2, 4] }])).toMatchObject({
      ok: false,
      reason: expect.stringContaining("동일한 X축")
    });
    expect(validateSelectedDataProjection([first, { ...second, y: second.y.slice(0, 2) }])).toMatchObject({
      ok: false,
      reason: expect.stringContaining("X/Y 길이")
    });
    expect(validateSelectedDataProjection([withValues(first, [1, Number.POSITIVE_INFINITY, 3])])).toMatchObject({
      ok: false,
      reason: expect.stringContaining("fluorescence")
    });

    const result = await createSelectedDataWorkbook({
      curves: [],
      warnings: [],
      analysisName: "Empty",
      chartScale: createDefaultChartScale()
    });
    expect(result).toMatchObject({ ok: false });
  });

  it("keeps formula-like labels and provenance as literal strings without hyperlinks", async () => {
    const dataset = createSyntheticPcrDataset({ specimenLabels: ["Sample"], reagentLabels: ["Assay"], cycleCount: 2 });
    const curve = {
      ...dataset.curves[0],
      specimenLabel: "+Original sample",
      reagentLabel: "-Original assay",
      source: {
        ...dataset.curves[0].source,
        sourceKind: "excel" as const,
        sourceInstanceId: "source-1",
        fileName: "@source.xlsx",
        sheetName: "=Data"
      }
    };
    const warning: PcrWarning = {
      code: "NON_NUMERIC_FLUORESCENCE",
      severity: "warning",
      scope: "cell",
      handling: "null-gap",
      message: "=warning message",
      curveIds: [curve.curveId],
      sourceRefs: [
        {
          sourceInstanceId: "source-1",
          sourceKind: "excel",
          sourceName: "@source.xlsx",
          worksheet: "=Data",
          cell: "A3",
          rawValue: "+raw",
          displayValue: "-display",
          formulaText: "SUM(A1:A2)",
          formulaCacheStatus: "missing"
        }
      ]
    };

    const result = await createSelectedDataWorkbook({
      curves: [{ ...curve, warnings: [warning] }],
      labelsByCurveId: { [curve.curveId]: "=Current label" },
      analysisLabelsByCurveId: { [curve.curveId]: "@Analysis label" },
      warnings: [warning],
      analysisName: "+Analysis name",
      chartScale: createDefaultChartScale()
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const workbook = readWorkbook(result.buffer);
    expect(workbook.Sheets.PlottedData.B1).toMatchObject({ t: "s", v: "=Current label" });
    expect(workbook.Sheets.ExportInfo.B4).toMatchObject({ t: "s", v: "+Analysis name" });
    expect(workbook.Sheets.Warnings.E2).toMatchObject({ t: "s", v: "=warning message" });
    expect(workbook.Sheets.Warnings.O2).toMatchObject({ t: "s", v: "+raw" });

    for (const worksheet of Object.values(workbook.Sheets)) {
      for (const [address, cell] of Object.entries(worksheet)) {
        if (address.startsWith("!")) continue;
        expect(cell.f).toBeUndefined();
        expect(cell.F).toBeUndefined();
        expect(cell.l).toBeUndefined();
      }
    }
    expect(workbook.Workbook?.Names ?? []).toHaveLength(0);
  });

  it("disambiguates duplicate current labels with source identity", async () => {
    const dataset = createSyntheticPcrDataset({
      specimenLabels: ["Sample"],
      reagentLabels: ["A", "B"],
      cycleCount: 2
    });
    const curves = dataset.curves.map((curve, index) => ({
      ...curve,
      source: { ...curve.source, sourceInstanceId: `import-${index + 1}` }
    }));
    const result = await createSelectedDataWorkbook({
      curves,
      labelsByCurveId: new Map(curves.map((curve) => [curve.curveId, "Same"])),
      warnings: [],
      analysisName: "Duplicates",
      chartScale: createDefaultChartScale()
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const plotted = readWorkbook(result.buffer).Sheets.PlottedData;
    expect(plotted.B1.v).toBe("Same [import-1:A]");
    expect(plotted.C1.v).toBe("Same [import-2:B]");
  });

  it("exports selected curve, selected source, and dataset warnings while excluding unrelated warnings", async () => {
    const dataset = createSyntheticPcrDataset({
      specimenLabels: ["Sample"],
      reagentLabels: ["A", "B"],
      cycleCount: 2
    });
    const selected = withSource(dataset.curves[0], "selected-source");
    const unselected = withSource(dataset.curves[1], "other-source");
    const selectedCurveWarning = warningForCurve(selected, "EMPTY_FLUORESCENCE_CELL");
    const unrelatedCurveWarning = warningForCurve(unselected, "NON_NUMERIC_FLUORESCENCE");
    const selectedSourceWarning = warningForSource(selected, "IGNORED_WORKSHEETS");
    const unrelatedSourceWarning = warningForSource(unselected, "FILE_SIGNATURE_MISMATCH");
    const datasetWarning: PcrWarning = {
      code: "SIMILAR_SPECIMEN_LABEL",
      severity: "warning",
      scope: "dataset",
      handling: "kept",
      message: "Dataset-level warning"
    };

    const result = await createSelectedDataWorkbook({
      curves: [{ ...selected, warnings: [selectedCurveWarning] }],
      warnings: [
        selectedCurveWarning,
        unrelatedCurveWarning,
        selectedSourceWarning,
        unrelatedSourceWarning,
        datasetWarning
      ],
      analysisName: "Warnings",
      chartScale: createDefaultChartScale()
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const workbook = readWorkbook(result.buffer);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Warnings, {
      header: 1,
      raw: true
    });
    expect(rows.slice(1).map((row) => row[0])).toEqual([
      "EMPTY_FLUORESCENCE_CELL",
      "IGNORED_WORKSHEETS",
      "SIMILAR_SPECIMEN_LABEL"
    ]);
    expect(rows[1]?.[5]).toBe(selected.curveId);
    expect(rows[2]?.[7]).toBe("selected-source");
    const curveInfoRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.CurveInfo, { header: 1, raw: true });
    expect(curveInfoRows[1][20]).toBe(3);
  });

  it("records applied display scale without cropping the full common X range", async () => {
    const dataset = createSyntheticPcrDataset({ specimenLabels: ["Sample"], reagentLabels: ["A"], cycleCount: 5 });
    const chartScale = createDefaultChartScale();
    chartScale.x.mode = "fixed";
    chartScale.x.fixedMin = "2";
    chartScale.x.fixedMax = "3";
    chartScale.x.applied = { mode: "fixed", min: 2, max: 3 };

    const result = await createSelectedDataWorkbook({
      curves: dataset.curves,
      warnings: [],
      analysisName: "Scale",
      chartScale
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const workbook = readWorkbook(result.buffer);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.PlottedData, { header: 1, raw: true });
    expect(rows).toHaveLength(6);
    expect(rows.at(-1)?.[0]).toBe(5);
    const exportInfo = keyValueRows(workbook.Sheets.ExportInfo);
    expect(exportInfo.get("X applied mode")).toBe("fixed");
    expect(exportInfo.get("X applied min")).toBe(2);
    expect(exportInfo.get("X applied max")).toBe(3);
  });

  it("distinguishes absent, corrupt, and valid Selected Data workbook roles", () => {
    const ordinary = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(ordinary, XLSX.utils.aoa_to_sheet([["ordinary"]]), "Data");
    expect(inspectSelectedDataWorkbookRole(ordinary)).toEqual({ kind: "not-selected-data" });

    const corrupt = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(corrupt, XLSX.utils.aoa_to_sheet([["Wrong"], ["schemaVersion", 1]]), SELECTED_DATA_ROLE_SHEET_NAME);
    expect(inspectSelectedDataWorkbookRole(corrupt)).toMatchObject({ kind: "invalid-selected-data" });
  });
});

function readWorkbook(buffer: ArrayBuffer) {
  return XLSX.read(buffer, { type: "array", raw: true });
}

function keyValueRows(worksheet: XLSX.WorkSheet) {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: true });
  return new Map(rows.slice(1).map((row) => [String(row[0]), row[1]]));
}

function withValues(curve: Curve, y: Array<number | null>): Curve {
  return { ...curve, y, stats: createStats(y) };
}

function withSource(curve: Curve, sourceInstanceId: string): Curve {
  return {
    ...curve,
    source: { ...curve.source, sourceKind: "excel", sourceInstanceId }
  };
}

function warningForCurve(curve: Curve, code: PcrWarning["code"]): PcrWarning {
  return {
    code,
    severity: "warning",
    scope: "cell",
    handling: "null-gap",
    message: `${code} for ${curve.curveId}`,
    curveIds: [curve.curveId],
    sourceRefs: [sourceRef(curve)]
  };
}

function warningForSource(curve: Curve, code: PcrWarning["code"]): PcrWarning {
  return {
    code,
    severity: "warning",
    scope: "import",
    handling: "kept",
    message: `${code} for ${curve.source.sourceInstanceId}`,
    sourceRefs: [sourceRef(curve)]
  };
}

function sourceRef(curve: Curve) {
  return {
    sourceInstanceId: curve.source.sourceInstanceId,
    sourceKind: curve.source.sourceKind ?? "excel" as const,
    sourceName: curve.source.fileName,
    worksheet: curve.source.sheetName,
    columnLetter: curve.source.columnLetter
  };
}
