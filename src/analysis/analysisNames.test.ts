import { describe, expect, it } from "vitest";
import { createDefaultAnalysisName, createImportedAnalysisName, stripFinalExcelExtension } from "./analysisNames";

describe("analysis names", () => {
  it.each([
    ["260803_data.xlsx", "260803_data"],
    ["sample.XLS", "sample"],
    ["sample.xlsx.xlsx", "sample.xlsx"],
    ["sample.xlsx.bak", "sample.xlsx.bak"],
    ["data.xlsx  ", "data"],
    ["Paste import 1", "Paste import 1"]
  ])("strips only a final Excel extension from %s", (source, expected) => {
    expect(stripFinalExcelExtension(source)).toBe(expected);
  });

  it("uses the supplied fallback when the source is only an extension", () => {
    expect(createDefaultAnalysisName(".xlsx", "Analysis 2")).toBe("Analysis 2");
  });

  it("does not apply Excel-extension semantics to Quick Paste trace names", () => {
    expect(createImportedAnalysisName("comparison.xlsx", "paste", "Analysis 2")).toBe("comparison.xlsx");
    expect(createImportedAnalysisName("comparison.xlsx", "excel", "Analysis 2")).toBe("comparison");
  });
});
