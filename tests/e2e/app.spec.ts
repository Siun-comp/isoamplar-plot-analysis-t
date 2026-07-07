import { expect, test, type Locator } from "@playwright/test";
import { writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

test("renders the upload-first PCR workspace", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "IsoAmplar Plot Analysis" })).toBeVisible();
  await expect(page.getByText("Developer Jang Si Un")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Excel 데이터" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "데이터 선택" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "그래프 미리보기" })).toBeVisible();
  await expect(page.getByText(".xls 또는 .xlsx 첫 번째 worksheet만 사용합니다.")).toBeVisible();
});

test("uploads an xlsx workbook and keeps reagent-first collapsed selection", async ({ page }, testInfo) => {
  const workbookPath = testInfo.outputPath("phase3-upload.xlsx");
  const appendWorkbookPath = testInfo.outputPath("phase3-append.xlsx");
  writeWorkbookFixture(workbookPath, "검체 1");
  writeWorkbookFixture(appendWorkbookPath, "검체 2");

  await page.goto("/");
  await page.locator("input[type='file']").first().setInputFiles(workbookPath);

  await expect(page.getByText(/phase3-upload.xlsx · 2 curves/)).toBeVisible();
  await expect(page.getByRole("radio", { name: "시약별" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: /▸ A1/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /▸ A2/ })).toBeVisible();
  await expect(page.getByText("검체 1 / A1")).toHaveCount(0);

  await page.getByRole("searchbox", { name: "검색" }).fill("A2");
  await expect(page.getByText("표시 1")).toBeVisible();
  await page.getByRole("button", { name: "표시 선택" }).click();
  await expect(page.getByText("선택 1")).toBeVisible();
  await expect(page.getByText("1개 curve 선택됨")).toBeVisible();

  await page.locator("input[type='file']").nth(1).setInputFiles(appendWorkbookPath);
  await expect(page.getByText(/combined_2_files · 4 curves/)).toBeVisible();
  await expect(page.getByText("선택 1")).toBeVisible();
  await expect(page.getByText("1개 curve 선택됨")).toBeVisible();

  const canvas = page.locator(".echarts-surface canvas");
  await expect(canvas).toBeVisible();
  await expect
    .poll(async () => await countNonWhiteCanvasPixels(canvas))
    .toBeGreaterThan(100);

  const chartWrap = page.locator(".chart-canvas-wrap");
  const before = await chartWrap.boundingBox();
  await page.locator(".settings-accordion summary", { hasText: "Style" }).click();
  await page.locator(".settings-accordion summary", { hasText: "Legend Order" }).click();
  await page.locator(".settings-accordion summary", { hasText: "Export" }).click();
  const after = await chartWrap.boundingBox();

  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(Math.abs((after?.height ?? 0) - (before?.height ?? 0))).toBeLessThan(2);

  await page.evaluate(() => window.scrollTo(0, 300));
  await expect
    .poll(async () => {
      const box = await page.locator(".chart-panel").boundingBox();
      return box?.y ?? 999;
    })
    .toBeLessThan(25);
});

function writeWorkbookFixture(filePath: string, specimenLabel: string) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    [specimenLabel, specimenLabel],
    ["A1", "A2"],
    [0.2, 0.25],
    [1.2, 1.4]
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  writeFileSync(filePath, buffer);
}

async function countNonWhiteCanvasPixels(canvasLocator: Locator) {
  return canvasLocator.evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (!context) return 0;
    const { width, height } = canvas;
    const image = context.getImageData(0, 0, width, height);
    let count = 0;

    for (let index = 0; index < image.data.length; index += 16) {
      const red = image.data[index];
      const green = image.data[index + 1];
      const blue = image.data[index + 2];
      const alpha = image.data[index + 3];
      if (alpha > 0 && (red < 245 || green < 245 || blue < 245)) {
        count += 1;
      }
    }

    return count;
  });
}
