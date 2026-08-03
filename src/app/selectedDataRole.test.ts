import { beforeEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { createDefaultChartScale } from "../chart/chartScale";
import {
  createSelectedDataWorkbook,
  LEGACY_SELECTED_DATA_WORKBOOK_SCHEMA_VERSION,
  SELECTED_DATA_ROLE_SHEET_NAME,
  SELECTED_DATA_WORKBOOK_MARKER
} from "../chart/selectedDataWorkbook";
import { createOneSpecimenEightReagentDataset } from "../data/sampleData";
import { SELECTED_DATA_INPUT_REJECTED_MESSAGE, useAppStore } from "./appStore";

describe("Selected Data XLSX input role", () => {
  beforeEach(() => useAppStore.getState().reset());

  it.each([
    ["original open", (file: File) => useAppStore.getState().importFile(file)],
    ["append", (file: File) => useAppStore.getState().appendFile(file)],
    ["analysis restore", (file: File) => useAppStore.getState().openAnalysisFile(file)]
  ])("rejects the output-only workbook through %s without dataset mutation", async (_label, openFile) => {
    const file = await createSelectedDataFile();

    await openFile(file);

    expect(useAppStore.getState().dataset).toBeNull();
    expect(useAppStore.getState().analysisOrder).toHaveLength(1);
    expect(useAppStore.getState().importError).toBe(SELECTED_DATA_INPUT_REJECTED_MESSAGE);
  });

  it("rejects a legacy schema-1 Selected Data workbook as output-only", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        [SELECTED_DATA_WORKBOOK_MARKER],
        ["schemaVersion", LEGACY_SELECTED_DATA_WORKBOOK_SCHEMA_VERSION],
        ["role", "selected-data-output-only"]
      ]),
      SELECTED_DATA_ROLE_SHEET_NAME
    );
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const file = { name: "legacy-selected-data.xlsx", arrayBuffer: async () => bytes } as File;

    await useAppStore.getState().importFile(file);

    expect(useAppStore.getState().dataset).toBeNull();
    expect(useAppStore.getState().importError).toBe(SELECTED_DATA_INPUT_REJECTED_MESSAGE);
  });
});

async function createSelectedDataFile() {
  const dataset = createOneSpecimenEightReagentDataset();
  const result = await createSelectedDataWorkbook({
    curves: dataset.curves.slice(0, 2),
    warnings: dataset.warnings,
    analysisName: "Synthetic selected data",
    chartScale: createDefaultChartScale(),
    exportedAt: "2026-07-12T00:00:00.000Z"
  });
  if (!result.ok) throw new Error(result.reason);
  return {
    name: "selected-data.xlsx",
    arrayBuffer: async () => result.buffer
  } as File;
}
