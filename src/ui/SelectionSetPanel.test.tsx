import { beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAppStore } from "../app/appStore";
import { createOneSpecimenEightReagentDataset } from "../data/sampleData";
import { SelectionSetPanel } from "./SelectionSetPanel";

function KeyedSelectionSetPanel() {
  const activeAnalysisId = useAppStore((state) => state.activeAnalysisId);
  return <SelectionSetPanel key={activeAnalysisId} />;
}

describe("SelectionSetPanel", () => {
  beforeEach(() => {
    useAppStore.getState().reset();
    useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset());
    const firstCurveId = useAppStore.getState().dataset!.orderedCurveIds[0];
    useAppStore.getState().setCurvesSelected([firstCurveId], true);
  });

  it("creates a set and applies it only after the explicit Apply action", async () => {
    const user = userEvent.setup();
    render(<SelectionSetPanel />);
    await user.click(screen.getByRole("button", { name: "현재 선택을 새 세트로 저장" }));
    await user.type(screen.getByLabelText("새 세트 이름"), "조건 비교 1");
    await user.click(screen.getByRole("button", { name: "확인" }));

    expect(screen.getByRole("option", { name: "조건 비교 1 (1)" })).toBeInTheDocument();
    const secondCurveId = useAppStore.getState().dataset!.orderedCurveIds[1];
    act(() => useAppStore.getState().toggleCurve(secondCurveId));
    expect(screen.getByText(/수정됨/u)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "적용" }));
    expect(useAppStore.getState().selection?.selectedCurveIds).toEqual(
      new Set(useAppStore.getState().selectionSets[0].curveIds)
    );
  });

  it("uses in-app confirmation for update and delete", async () => {
    const user = userEvent.setup();
    useAppStore.getState().createSelectionSet("조건 A");
    render(<SelectionSetPanel />);
    const secondCurveId = useAppStore.getState().dataset!.orderedCurveIds[1];
    act(() => useAppStore.getState().toggleCurve(secondCurveId));
    await user.click(screen.getByText("관리"));
    await user.click(screen.getByRole("button", { name: "현재 선택으로 업데이트" }));
    expect(screen.getByRole("group", { name: "선택 세트 업데이트 확인" })).toHaveTextContent("추가 1개 / 제외 0개");
    await user.click(screen.getByRole("button", { name: "업데이트" }));
    expect(useAppStore.getState().selectionSets[0].curveIds).toHaveLength(2);
    await waitFor(() => expect(screen.getByLabelText("적용할 선택 세트")).toHaveFocus());

    await user.click(screen.getByRole("button", { name: "삭제" }));
    expect(screen.getByRole("group", { name: "선택 세트 삭제 확인" })).toBeInTheDocument();
    await user.click(screen.getByRole("group", { name: "선택 세트 삭제 확인" }).querySelector("button")!);
    expect(useAppStore.getState().selectionSets).toHaveLength(0);
    await waitFor(() => expect(screen.getByRole("button", { name: "현재 선택을 새 세트로 저장" })).toHaveFocus());
  });

  it("keeps twenty named sets available through the compact selector", async () => {
    const user = userEvent.setup();
    const longName = "L".repeat(120);
    for (let index = 1; index <= 20; index += 1) {
      useAppStore.getState().createSelectionSet(index === 20 ? longName : `Condition ${index.toString().padStart(2, "0")}`);
    }

    render(<SelectionSetPanel />);

    expect(screen.getAllByRole("option")).toHaveLength(20);
    expect(screen.getByRole("option", { name: `${longName} (1)` })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("적용할 선택 세트"), "selection-set-20");
    await user.click(screen.getByRole("button", { name: "적용" }));
    expect(useAppStore.getState().activeSelectionSetId).toBe("selection-set-20");
  });

  it("synchronizes a newly created active set and freezes the selected management target", async () => {
    const user = userEvent.setup();
    useAppStore.getState().createSelectionSet("Set A");
    render(<SelectionSetPanel />);
    const secondCurveId = useAppStore.getState().dataset!.orderedCurveIds[1];
    act(() => useAppStore.getState().toggleCurve(secondCurveId));
    await user.click(screen.getByRole("button", { name: "새 세트" }));
    await user.type(screen.getByLabelText("새 세트 이름"), "Set B");
    await user.click(screen.getByRole("button", { name: "확인" }));

    expect(screen.getByLabelText("적용할 선택 세트")).toHaveValue("selection-set-2");
    expect(screen.getByText(/현재 적용: Set B/u)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("적용할 선택 세트"), "selection-set-1");
    await user.click(screen.getByText("관리"));
    await user.click(screen.getByRole("button", { name: "삭제" }));
    expect(screen.getByRole("group", { name: "선택 세트 삭제 확인" })).toHaveTextContent("Set A 세트만 삭제");
    expect(screen.getByLabelText("적용할 선택 세트")).toBeDisabled();
  });

  it("discards an open editor when the active analysis tab changes", async () => {
    const user = userEvent.setup();
    useAppStore.getState().createSelectionSet("First tab set");
    render(<KeyedSelectionSetPanel />);
    await user.click(screen.getByText("관리"));
    await user.click(screen.getByRole("button", { name: "삭제" }));
    expect(screen.getByRole("group", { name: "선택 세트 삭제 확인" })).toBeInTheDocument();

    act(() => {
      useAppStore.getState().createAnalysis("Second tab");
      useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset());
      const firstCurveId = useAppStore.getState().dataset!.orderedCurveIds[0];
      useAppStore.getState().setCurvesSelected([firstCurveId], true);
      useAppStore.getState().createSelectionSet("Second tab set");
    });

    expect(screen.queryByRole("group", { name: "선택 세트 삭제 확인" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Second tab set (1)" })).toBeInTheDocument();
  });
});
