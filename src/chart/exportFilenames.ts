export type ImageExportType = "png" | "jpeg";

export function createDateStamp(date = new Date()) {
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function createImageExportFileName(
  plotNumber: number,
  type: ImageExportType,
  date = new Date(),
  analysisName?: string
) {
  return `${createFileNameStem("plot", plotNumber, date, analysisName)}.${type === "jpeg" ? "jpg" : "png"}`;
}

export function createPlottedDataFileName(plotNumber: number, date = new Date(), analysisName?: string) {
  return `${createFileNameStem("plot", plotNumber, date, analysisName)}_data.csv`;
}

export function createFileNameStem(kind: "plot" | "analysis", number: number, date = new Date(), analysisName?: string) {
  const nameSegment = analysisName === undefined ? "" : `${sanitizeFileNamePart(analysisName) || "analysis"}_`;
  return `${createDateStamp(date)}_${nameSegment}${kind}${number}`;
}

export function sanitizeFileNamePart(value: string) {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/gu, "_")
    .replace(/\s+/gu, "_")
    .replace(/_+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 80);
}
