import { describe, expect, it } from "vitest";
import { createDateStamp, createImageExportFileName, createPlottedDataFileName } from "./exportFilenames";

describe("export filenames", () => {
  it("uses YYMMDD_plotN naming", () => {
    const date = new Date(2026, 6, 7);

    expect(createDateStamp(date)).toBe("260707");
    expect(createImageExportFileName(1, "png", date)).toBe("260707_plot1.png");
    expect(createImageExportFileName(2, "jpeg", date)).toBe("260707_plot2.jpg");
    expect(createPlottedDataFileName(3, date)).toBe("260707_plot3_data.csv");
  });
});

