import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { createOneSpecimenEightReagentDataset } from "../data/sampleData";
import { App } from "./App";
import { useAppStore } from "./appStore";

describe("App PCR workspace", () => {
  beforeEach(() => {
    useAppStore.getState().reset();
  });

  it("renders the upload-first PCR workspace shell", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "IsoAmplar Plot Analysis" })).toBeInTheDocument();
    expect(screen.getByText("Developer Jang Si Un")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Excel 데이터" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "데이터 선택" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "그래프 미리보기" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "설정" })).toBeInTheDocument();
    expect(screen.getByText(".xls 또는 .xlsx 첫 번째 worksheet만 사용합니다.")).toBeInTheDocument();
  });

  it("starts imported datasets in reagent-first view with all major groups collapsed", () => {
    act(() => {
      useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset());
    });

    render(<App />);

    expect(screen.getByRole("radio", { name: "시약별" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("표시 8")).toBeInTheDocument();
    expect(screen.getByText("선택 0")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /▸ A/ })).toHaveLength(8);
    expect(screen.queryByText("검체 1 / A1")).not.toBeInTheDocument();
  });

  it("applies search bulk selection to all matching collapsed curves by curveId", async () => {
    const user = userEvent.setup();
    act(() => {
      useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset());
    });

    render(<App />);

    await user.type(screen.getByRole("searchbox", { name: "검색" }), "A8");
    expect(screen.getByText("표시 1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "표시 선택" }));

    expect(screen.getByText("선택 1")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "검체별" }));
    expect(screen.getByRole("radio", { name: "검체별" })).toHaveAttribute("aria-checked", "true");
    expect(within(screen.getByRole("complementary", { name: "데이터 선택" })).getAllByText("검체별").length).toBeGreaterThan(1);
    expect(screen.getByText("선택 1")).toBeInTheDocument();
  });

  it("shows selected auto scale bounds and can copy them into fixed scale inputs", async () => {
    const user = userEvent.setup();
    const dataset = createOneSpecimenEightReagentDataset();
    act(() => {
      useAppStore.getState().loadDataset(dataset);
      useAppStore.getState().setCurvesSelected([dataset.curves[0].curveId], true);
    });

    render(<App />);

    const xAxis = screen.getByRole("region", { name: "X axis" });
    expect(within(xAxis).getByText("Auto range: 1 - 45")).toBeInTheDocument();

    await user.click(within(xAxis).getByRole("button", { name: "Fixed" }));
    await user.click(within(xAxis).getByRole("button", { name: "현재 Auto값 적용" }));
    const fixedInputs = within(xAxis).getAllByRole("spinbutton").slice(0, 2);

    expect(fixedInputs[0]).toHaveValue(1);
    expect(fixedInputs[1]).toHaveValue(45);
  });

  it("accepts HEX color input for group and individual curve styles", async () => {
    const user = userEvent.setup();
    const dataset = createOneSpecimenEightReagentDataset();
    act(() => {
      useAppStore.getState().loadDataset(dataset);
      useAppStore.getState().setCurvesSelected([dataset.curves[0].curveId], true);
    });

    render(<App />);
    await user.click(screen.getByText("Style"));

    const reagentHex = screen.getByRole("textbox", { name: "A1 hex color" });
    await user.clear(reagentHex);
    await user.type(reagentHex, "#123abc");
    expect(useAppStore.getState().styleRules.reagentColors[dataset.reagents[0].id]).toBe("#123abc");

    const curveHex = screen.getByRole("textbox", { name: "A1 / 검체 1 hex color" });
    await user.clear(curveHex);
    await user.type(curveHex, "f80");
    await user.tab();
    expect(useAppStore.getState().curveOverrides[dataset.curves[0].curveId].color).toBe("#ff8800");
  });
});
