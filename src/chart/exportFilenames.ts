export type ImageExportType = "png" | "jpeg";

export function createDateStamp(date = new Date()) {
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function createImageExportFileName(plotNumber: number, type: ImageExportType, date = new Date()) {
  return `${createDateStamp(date)}_plot${plotNumber}.${type === "jpeg" ? "jpg" : "png"}`;
}

export function createPlottedDataFileName(plotNumber: number, date = new Date()) {
  return `${createDateStamp(date)}_plot${plotNumber}_data.csv`;
}

