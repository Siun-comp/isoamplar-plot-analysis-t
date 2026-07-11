import type * as XLSX from "xlsx";
import type { ChartScaleState } from "./chartScale";
import type { Curve, PcrWarning, WarningSourceRef } from "../data/types";

type XlsxModule = typeof import("xlsx");
type WorkbookCellValue = string | number | boolean | undefined;

export const SELECTED_DATA_ROLE_SHEET_NAME = "_IsoAmplarSelectedData";
export const SELECTED_DATA_WORKBOOK_MARKER = "IsoAmplarSelectedData";
export const SELECTED_DATA_WORKBOOK_SCHEMA_VERSION = 1;

const PLOTTED_DATA_SHEET_NAME = "PlottedData";
const CURVE_INFO_SHEET_NAME = "CurveInfo";
const WARNINGS_SHEET_NAME = "Warnings";
const EXPORT_INFO_SHEET_NAME = "ExportInfo";

export type SelectedDataLabelLookup =
  | ReadonlyMap<string, string>
  | Readonly<Record<string, string>>;

export type SelectedDataWorkbookArgs = {
  /** Curves must already be projected into the current user legend/export order. */
  curves: readonly Curve[];
  labelsByCurveId?: SelectedDataLabelLookup;
  analysisLabelsByCurveId?: SelectedDataLabelLookup;
  warnings: readonly PcrWarning[];
  analysisName: string;
  chartScale: ChartScaleState;
  exportedAt?: Date | string;
};

export type SelectedDataWorkbookResult =
  | { ok: true; buffer: ArrayBuffer }
  | { ok: false; reason: string };

export type SelectedDataWorkbookRole =
  | { kind: "selected-data"; schemaVersion: typeof SELECTED_DATA_WORKBOOK_SCHEMA_VERSION }
  | { kind: "not-selected-data" }
  | { kind: "invalid-selected-data"; message: string };

let xlsxModulePromise: Promise<XlsxModule> | null = null;

export function validateSelectedDataProjection(curves: readonly Curve[]): { ok: true } | { ok: false; reason: string } {
  if (curves.length === 0) {
    return { ok: false, reason: "선택 데이터 XLSX로 저장할 곡선이 없습니다." };
  }

  const referenceX = curves[0].x;
  if (referenceX.some((value) => !Number.isFinite(value))) {
    return { ok: false, reason: "선택 곡선의 X축에 유효하지 않은 숫자가 있습니다." };
  }

  for (const curve of curves) {
    if (curve.x.length !== referenceX.length || curve.y.length !== referenceX.length) {
      return { ok: false, reason: "선택 곡선의 X/Y 길이가 달라 하나의 표로 저장할 수 없습니다." };
    }
    if (curve.x.some((value, index) => value !== referenceX[index])) {
      return { ok: false, reason: "선택 곡선이 동일한 X축을 공유하지 않아 하나의 표로 저장할 수 없습니다." };
    }
    if (curve.y.some((value) => value !== null && !Number.isFinite(value))) {
      return { ok: false, reason: "선택 곡선에 유효하지 않은 fluorescence 숫자가 있습니다." };
    }
  }

  return { ok: true };
}

export async function createSelectedDataWorkbook(
  args: SelectedDataWorkbookArgs
): Promise<SelectedDataWorkbookResult> {
  const validation = validateSelectedDataProjection(args.curves);
  if (!validation.ok) return validation;

  const xlsx = await loadXlsx();
  const workbook = xlsx.utils.book_new();
  const labels = args.curves.map((curve) => lookupLabel(args.labelsByCurveId, curve.curveId) ?? curve.displayLabel);
  const headers = createUniqueHeaders(args.curves, labels);
  const warnings = collectRelevantWarnings(args.curves, args.warnings);

  appendSheet(xlsx, workbook, PLOTTED_DATA_SHEET_NAME, createPlottedDataRows(args.curves, headers));
  appendSheet(
    xlsx,
    workbook,
    CURVE_INFO_SHEET_NAME,
    createCurveInfoRows(args.curves, headers, labels, warnings, args.analysisLabelsByCurveId)
  );
  appendSheet(xlsx, workbook, WARNINGS_SHEET_NAME, createWarningRows(args.curves, warnings));
  appendSheet(xlsx, workbook, EXPORT_INFO_SHEET_NAME, createExportInfoRows(args));
  appendSheet(xlsx, workbook, SELECTED_DATA_ROLE_SHEET_NAME, createRoleRows());
  hideSheet(workbook, SELECTED_DATA_ROLE_SHEET_NAME);
  assertDataOnlyWorkbook(workbook);

  const output = xlsx.write(workbook, { type: "array", bookType: "xlsx", compression: true }) as
    | ArrayBuffer
    | Uint8Array
    | number[];
  return { ok: true, buffer: toArrayBuffer(output) };
}

export function inspectSelectedDataWorkbookRole(workbook: XLSX.WorkBook): SelectedDataWorkbookRole {
  const roleSheet = workbook.Sheets[SELECTED_DATA_ROLE_SHEET_NAME];
  const visibleMarker = workbook.Sheets[EXPORT_INFO_SHEET_NAME]?.B2?.v;

  if (!roleSheet) {
    return visibleMarker === SELECTED_DATA_WORKBOOK_MARKER
      ? { kind: "invalid-selected-data", message: "Selected Data XLSX role sheet is missing." }
      : { kind: "not-selected-data" };
  }
  if (roleSheet.A1?.v !== SELECTED_DATA_WORKBOOK_MARKER) {
    return { kind: "invalid-selected-data", message: "Selected Data XLSX marker is invalid." };
  }
  if (roleSheet.A2?.v !== "schemaVersion" || roleSheet.B2?.v !== SELECTED_DATA_WORKBOOK_SCHEMA_VERSION) {
    return { kind: "invalid-selected-data", message: "Selected Data XLSX schema version is unsupported." };
  }
  return { kind: "selected-data", schemaVersion: SELECTED_DATA_WORKBOOK_SCHEMA_VERSION };
}

function createPlottedDataRows(curves: readonly Curve[], headers: readonly string[]): WorkbookCellValue[][] {
  const rows: WorkbookCellValue[][] = [["Cycle", ...headers]];
  const referenceX = curves[0].x;
  for (let rowIndex = 0; rowIndex < referenceX.length; rowIndex += 1) {
    const row: WorkbookCellValue[] = [referenceX[rowIndex]];
    for (const curve of curves) row.push(curve.y[rowIndex] ?? undefined);
    rows.push(row);
  }
  return rows;
}

function createCurveInfoRows(
  curves: readonly Curve[],
  headers: readonly string[],
  currentLabels: readonly string[],
  relevantWarnings: readonly PcrWarning[],
  analysisLabelsByCurveId?: SelectedDataLabelLookup
): WorkbookCellValue[][] {
  const rows: WorkbookCellValue[][] = [
    [
      "Order",
      "Curve ID",
      "Export header",
      "Current label",
      "Analysis label",
      "Original specimen",
      "Original reagent",
      "Source kind",
      "Source instance ID",
      "Source name",
      "Worksheet",
      "Input mode",
      "Source sheet index",
      "Source column",
      "Specimen cell",
      "Reagent cell",
      "Data range",
      "Point count",
      "Finite value count",
      "Null count",
      "Warning count"
    ]
  ];

  curves.forEach((curve, index) => {
    const finiteValueCount = curve.y.reduce<number>(
      (count, value) => count + (typeof value === "number" && Number.isFinite(value) ? 1 : 0),
      0
    );
    rows.push([
      index + 1,
      curve.curveId,
      headers[index],
      currentLabels[index],
      lookupLabel(analysisLabelsByCurveId, curve.curveId) ?? "",
      curve.specimenLabel,
      curve.reagentLabel,
      curve.source.sourceKind ?? "excel",
      curve.source.sourceInstanceId ?? "",
      curve.source.fileName,
      curve.source.sheetName,
      curve.source.inputMode ?? "",
      curve.source.sheetIndex,
      curve.source.columnLetter,
      curve.source.specimenCell,
      curve.source.reagentCell,
      `${curve.source.dataStartCell}:${curve.source.dataEndCell}`,
      curve.y.length,
      finiteValueCount,
      curve.y.length - finiteValueCount,
      relevantWarnings.filter((warning) => warningAppliesToCurves(warning, [curve])).length
    ]);
  });
  return rows;
}

function createWarningRows(curves: readonly Curve[], warnings: readonly PcrWarning[]): WorkbookCellValue[][] {
  const selectedCurveIds = new Set(curves.map((curve) => curve.curveId));
  const rows: WorkbookCellValue[][] = [
    [
      "Code",
      "Severity",
      "Scope",
      "Handling",
      "Message",
      "Curve IDs",
      "Labels",
      "Source ID",
      "Source kind",
      "Source name",
      "Worksheet",
      "Cell",
      "Range",
      "Column",
      "Raw value",
      "Display value",
      "Cell type",
      "Number format",
      "Formula",
      "Formula cache"
    ]
  ];

  for (const warning of warnings) {
    const selectedWarningCurveIds = warning.curveIds?.filter((curveId) => selectedCurveIds.has(curveId)) ?? [];
    const matchingSourceRefs = warning.sourceRefs?.filter((sourceRef) => sourceRefMatchesCurves(sourceRef, curves)) ?? [];
    const sourceRefs = matchingSourceRefs.length > 0
      ? matchingSourceRefs
      : selectedWarningCurveIds.length > 0 && warning.sourceRefs?.length
        ? warning.sourceRefs
        : [undefined];
    for (const sourceRef of sourceRefs) {
      rows.push([
        warning.code,
        warning.severity,
        warning.scope,
        warning.handling ?? "",
        warning.message,
        selectedWarningCurveIds.join(", "),
        warning.labels?.join(", ") ?? "",
        sourceRef?.sourceInstanceId ?? "",
        sourceRef?.sourceKind ?? "",
        sourceRef?.sourceName ?? "",
        sourceRef?.worksheet ?? warning.sheetName ?? "",
        sourceRef?.cell ?? warning.sourceCell ?? "",
        sourceRef?.range ?? warning.sourceRange ?? "",
        sourceRef?.columnLetter ?? warning.columnLetter ?? "",
        toWorkbookValue(sourceRef?.rawValue ?? warning.rawValue),
        sourceRef?.displayValue ?? "",
        sourceRef?.cellType ?? "",
        sourceRef?.numberFormat ?? "",
        sourceRef?.formulaText ?? "",
        sourceRef?.formulaCacheStatus ?? ""
      ]);
    }
  }
  return rows;
}

function createExportInfoRows(args: SelectedDataWorkbookArgs): WorkbookCellValue[][] {
  const exportedAt = args.exportedAt instanceof Date
    ? args.exportedAt.toISOString()
    : args.exportedAt ?? new Date().toISOString();
  return [
    ["Field", "Value"],
    ["Workbook marker", SELECTED_DATA_WORKBOOK_MARKER],
    ["Schema version", SELECTED_DATA_WORKBOOK_SCHEMA_VERSION],
    ["Analysis name", args.analysisName],
    ["Exported at", exportedAt],
    ["Selected curve count", args.curves.length],
    ["X applied mode", args.chartScale.x.applied.mode],
    ["X applied min", args.chartScale.x.applied.min ?? undefined],
    ["X applied max", args.chartScale.x.applied.max ?? undefined],
    ["Y applied mode", args.chartScale.y.applied.mode],
    ["Y applied min", args.chartScale.y.applied.min ?? undefined],
    ["Y applied max", args.chartScale.y.applied.max ?? undefined],
    ["Applied scale note", "Display metadata only; exported rows are not cropped by the applied scale."],
    ["Exported rows", "Full common X range"],
    ["Fluorescence transform", "None"],
    ["Native editable Excel chart", "Not included"],
    ["App analysis restore", "Not supported; use Analysis XLSX to continue an analysis."]
  ];
}

function createRoleRows(): WorkbookCellValue[][] {
  return [
    [SELECTED_DATA_WORKBOOK_MARKER],
    ["schemaVersion", SELECTED_DATA_WORKBOOK_SCHEMA_VERSION],
    ["role", "selected-data-output-only"]
  ];
}

function collectRelevantWarnings(curves: readonly Curve[], datasetWarnings: readonly PcrWarning[]) {
  const candidates = [...datasetWarnings, ...curves.flatMap((curve) => curve.warnings)];
  const seen = new Set<string>();
  const relevant: PcrWarning[] = [];
  for (const warning of candidates) {
    if (!warningAppliesToCurves(warning, curves)) continue;
    const key = stableWarningKey(warning);
    if (seen.has(key)) continue;
    seen.add(key);
    relevant.push(warning);
  }
  return relevant;
}

function warningAppliesToCurves(warning: PcrWarning, curves: readonly Curve[]) {
  const selectedCurveIds = new Set(curves.map((curve) => curve.curveId));
  if (warning.curveIds?.length) return warning.curveIds.some((curveId) => selectedCurveIds.has(curveId));
  if (warning.sourceRefs?.length) return warning.sourceRefs.some((sourceRef) => sourceRefMatchesCurves(sourceRef, curves));
  if (warning.columnLetter) return curves.some((curve) => curve.source.columnLetter === warning.columnLetter);
  return true;
}

function sourceRefMatchesCurves(sourceRef: WarningSourceRef, curves: readonly Curve[]) {
  return curves.some((curve) => {
    if (sourceRef.sourceInstanceId && curve.source.sourceInstanceId) {
      return sourceRef.sourceInstanceId === curve.source.sourceInstanceId;
    }
    if (sourceRef.sourceName !== curve.source.fileName) return false;
    if (sourceRef.sourceKind && sourceRef.sourceKind !== (curve.source.sourceKind ?? "excel")) return false;
    return true;
  });
}

function stableWarningKey(warning: PcrWarning) {
  return JSON.stringify([
    warning.code,
    warning.severity,
    warning.scope,
    warning.handling,
    warning.message,
    warning.curveIds,
    warning.sourceCell,
    warning.sourceRange,
    warning.columnLetter,
    warning.sourceRefs
  ]);
}

function createUniqueHeaders(curves: readonly Curve[], labels: readonly string[]) {
  const counts = new Map<string, number>();
  labels.forEach((label) => counts.set(label, (counts.get(label) ?? 0) + 1));
  const used = new Set<string>();
  return labels.map((label, index) => {
    const baseLabel = label || curves[index].curveId;
    const duplicateBase = (counts.get(label) ?? 0) > 1
      ? `${baseLabel} [${sourceSuffix(curves[index])}]`
      : baseLabel;
    let candidate = duplicateBase;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${duplicateBase} [${suffix}]`;
      suffix += 1;
    }
    used.add(candidate);
    return candidate;
  });
}

function sourceSuffix(curve: Curve) {
  return `${curve.source.sourceInstanceId || curve.source.fileName}:${curve.source.columnLetter}`;
}

function lookupLabel(lookup: SelectedDataLabelLookup | undefined, curveId: string) {
  if (!lookup) return undefined;
  if ("get" in lookup && typeof lookup.get === "function") return lookup.get(curveId);
  return (lookup as Readonly<Record<string, string>>)[curveId];
}

function toWorkbookValue(value: unknown): WorkbookCellValue {
  if (value === undefined) return undefined;
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function appendSheet(
  xlsx: XlsxModule,
  workbook: XLSX.WorkBook,
  sheetName: string,
  rows: WorkbookCellValue[][]
) {
  const worksheet = xlsx.utils.aoa_to_sheet(rows, { cellDates: false });
  forceLiteralCellTypes(worksheet);
  xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
}

function forceLiteralCellTypes(worksheet: XLSX.WorkSheet) {
  for (const [address, cell] of Object.entries(worksheet)) {
    if (address.startsWith("!")) continue;
    delete cell.f;
    delete cell.F;
    delete cell.l;
    if (typeof cell.v === "string") cell.t = "s";
    else if (typeof cell.v === "number") cell.t = "n";
    else if (typeof cell.v === "boolean") cell.t = "b";
  }
}

function assertDataOnlyWorkbook(workbook: XLSX.WorkBook) {
  for (const worksheet of Object.values(workbook.Sheets)) {
    for (const [address, cell] of Object.entries(worksheet)) {
      if (address.startsWith("!")) continue;
      if (cell.f || cell.F || cell.l) throw new Error("Selected Data XLSX contains a formula or hyperlink cell.");
    }
  }
}

function hideSheet(workbook: XLSX.WorkBook, sheetName: string) {
  workbook.Workbook ??= {};
  workbook.Workbook.Sheets = workbook.SheetNames.map((name) => ({
    name,
    Hidden: name === sheetName ? 1 : 0
  }));
}

function toArrayBuffer(output: ArrayBuffer | Uint8Array | number[]) {
  if (output instanceof ArrayBuffer) return output;
  if (Array.isArray(output)) return new Uint8Array(output).buffer;
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
}

function loadXlsx() {
  xlsxModulePromise ??= import("xlsx");
  return xlsxModulePromise;
}
