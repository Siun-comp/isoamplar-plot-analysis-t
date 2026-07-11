import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultChartScale } from "../chart/chartScale";
import { createSelectedDataWorkbook } from "../chart/selectedDataWorkbook";
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
