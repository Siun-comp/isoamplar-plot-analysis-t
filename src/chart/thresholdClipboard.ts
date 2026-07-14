import type { ThresholdOutcome, ThresholdResult } from "../analysis/threshold";
import type { Curve } from "../data/types";
import { copyHtmlTableToClipboard } from "./exportChart";
import { formatThresholdValue } from "./thresholdRender";

const HEADERS = ["검체", "시약", "추정 교차 Cycle", "결과 상태"] as const;

export async function copyThresholdResultsExcelTableToClipboard(args: {
  curves: readonly Curve[];
  results: readonly ThresholdResult[];
}) {
  const payload = createThresholdResultsExcelClipboardPayload(args);
  await copyHtmlTableToClipboard(payload.html, payload.text);
}

export function createThresholdResultsExcelClipboardPayload(args: {
  curves: readonly Curve[];
  results: readonly ThresholdResult[];
}) {
  const curvesById = new Map(args.curves.map((curve) => [curve.curveId, curve]));
  const rows = args.results.map((result) => {
    const curve = curvesById.get(result.curveId);
    if (!curve) throw new Error(`Threshold result curve is missing: ${result.curveId}`);
    return {
      specimen: curve.specimenLabel,
      reagent: curve.reagentLabel,
      estimatedCycle: getEstimatedCrossingCycle(result),
      status: formatThresholdClipboardStatus(result)
    };
  });

  const headerHtml = HEADERS.map((header) => `<th style="${headerCellStyle()}">${header}</th>`).join("");
  const bodyHtml = rows
    .map(
      (row) => `<tr>
    <td style="${textCellStyle()}">${escapeExcelHtmlText(row.specimen)}</td>
    <td style="${textCellStyle()}">${escapeExcelHtmlText(row.reagent)}</td>
    <td style="${numberCellStyle()}">${row.estimatedCycle === null ? "" : formatThresholdValue(row.estimatedCycle)}</td>
    <td style="${textCellStyle()}">${escapeExcelHtmlText(row.status)}</td>
  </tr>`
    )
    .join("");
  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body>
<table style="border-collapse:collapse;background:#ffffff;">
  <thead><tr>${headerHtml}</tr></thead>
  <tbody>${bodyHtml}</tbody>
</table>
</body>
</html>`;
  const text = [
    HEADERS.join("\t"),
    ...rows.map((row) =>
      [
        sanitizeExcelPlainText(row.specimen),
        sanitizeExcelPlainText(row.reagent),
        row.estimatedCycle === null ? "" : formatThresholdValue(row.estimatedCycle),
        sanitizeExcelPlainText(row.status)
      ].join("\t")
    )
  ].join("\r\n");

  return { html, text };
}

export function formatThresholdClipboardStatus(result: ThresholdResult) {
  if (result.outcome === "crossed" && result.multipleUpwardCrossings) return "교차 (다중 교차 검토)";
  const labels: Record<ThresholdOutcome, string> = {
    crossed: "교차",
    "not-reached": "미도달",
    "starts-at-threshold": "시작점=Threshold",
    "starts-above-threshold": "시작점 초과",
    "indeterminate-leading-gap": "선행 결측",
    "indeterminate-gap": "결측 구간",
    "insufficient-data": "데이터 부족"
  };
  return labels[result.outcome];
}

function getEstimatedCrossingCycle(result: ThresholdResult) {
  if (result.outcome !== "crossed") return null;
  const value = result.primaryEvent?.interpolatedCycle;
  return value !== null && value !== undefined && Number.isFinite(value) ? value : null;
}

function headerCellStyle() {
  return "padding:5px 8px;border:1px solid #d8dee8;background:#f8fafc;text-align:left;font-family:'Malgun Gothic',Arial,sans-serif;font-size:9pt;font-weight:700;color:#263448;white-space:nowrap;";
}

function textCellStyle() {
  return "padding:5px 8px;border:1px solid #d8dee8;mso-number-format:'\\@';font-family:'Malgun Gothic',Arial,sans-serif;font-size:9pt;color:#263448;white-space:nowrap;";
}

function numberCellStyle() {
  return "padding:5px 8px;border:1px solid #d8dee8;mso-number-format:'General';font-family:'Malgun Gothic',Arial,sans-serif;font-size:9pt;color:#263448;text-align:right;white-space:nowrap;";
}

function escapeExcelHtmlText(value: string) {
  return escapeHtml(sanitizeExcelText(value)).replaceAll("\u200B", "&#8203;");
}

function sanitizeExcelPlainText(value: string) {
  return sanitizeExcelText(value).replaceAll("\t", " ").replaceAll(/\r?\n/gu, " ");
}

function sanitizeExcelText(value: string) {
  return /^[=+\-@]/u.test(value.trimStart()) ? `\u200B${value}` : value;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
