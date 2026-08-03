import type { DatasetSourceKind } from "../data/types";

export function stripFinalExcelExtension(value: string) {
  return value.trim().replace(/\.(?:xlsx|xls)$/iu, "");
}

export function createDefaultAnalysisName(sourceName: string, fallback: string) {
  const normalized = stripFinalExcelExtension(sourceName).trim();
  return normalized || fallback;
}

export function createImportedAnalysisName(sourceName: string, sourceKind: DatasetSourceKind | undefined, fallback: string) {
  const normalized = sourceKind === "paste" ? sourceName.trim() : stripFinalExcelExtension(sourceName);
  return normalized || fallback;
}
