import { describe, expect, it } from "vitest";
import { createDateStamp, createImageExportFileName, createPlottedDataFileName, sanitizeFileNamePart } from "./exportFilenames";

describe("export filenames", () => {
  it("uses YYMMDD_plotN naming", () => {
    const date = new Date(2026, 6, 7);

    expect(createDateStamp(date)).toBe("260707");
    expect(createImageExportFileName(1, "png", date)).toBe("260707_plot1.png");
    expect(createImageExportFileName(2, "jpeg", date)).toBe("260707_plot2.jpg");
    expect(createPlottedDataFileName(3, date)).toBe("260707_plot3_data.csv");
  });

  it("can include a sanitized analysis name before the plot number", () => {
    const date = new Date(2026, 6, 9);

    expect(createImageExportFileName(1, "png", date, "Run A")).toBe("260709_Run_A_plot1.png");
    expect(createImageExportFileName(2, "jpeg", date, "Run A")).toBe("260709_Run_A_plot2.jpg");
    expect(createPlottedDataFileName(3, date, "Run A")).toBe("260709_Run_A_plot3_data.csv");
    expect(createImageExportFileName(4, "png", date, "  ")).toBe("260709_analysis_plot4.png");
    expect(sanitizeFileNamePart(' a/b:c* run "x" ')).toBe("a_b_c_run_x");
    expect(sanitizeFileNamePart("한글 분석")).toBe("한글_분석");
  });
});
