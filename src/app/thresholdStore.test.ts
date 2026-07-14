import { beforeEach, describe, expect, it } from "vitest";
import { createOneSpecimenEightReagentDataset, createSyntheticPcrDataset } from "../data/sampleData";
import { parsePastedTable } from "../data/parsePastedTable";
import { THRESHOLD_RULE_ID, createDefaultThresholdSettings } from "../analysis/threshold";
import { useAppStore } from "./appStore";

describe("Threshold tab state", () => {
  beforeEach(() => {
    useAppStore.getState().reset();
    useAppStore.getState().loadDataset(createOneSpecimenEightReagentDataset());
  });

  it("requires an applied value before enabling and applies only strict finite decimal input", () => {
    expect(useAppStore.getState().setThresholdEnabled(true)).toEqual({
      ok: false,
      message: "Apply a valid raw fluorescence Threshold before enabling it."
    });
    useAppStore.getState().setThresholdDraftValue("0x10");
    expect(useAppStore.getState().applyThresholdDraft()).toMatchObject({ ok: false });
    useAppStore.getState().setThresholdDraftValue("1.25e3");
    expect(useAppStore.getState().applyThresholdDraft()).toEqual({ ok: true });
    expect(useAppStore.getState().thresholdSettings).toEqual({
      enabled: true,
      draftValue: "1.25e3",
      applied: { value: 1250, ruleId: THRESHOLD_RULE_ID },
      showInPreview: true,
      includeInPlotExport: true
    });
  });

  it("keeps draft/applied separate and preserves independent display options", () => {
    useAppStore.getState().setThresholdDraftValue("100");
    useAppStore.getState().applyThresholdDraft();
    useAppStore.getState().setThresholdDraftValue("200");
    useAppStore.getState().setThresholdShowInPreview(false);
    useAppStore.getState().setThresholdIncludeInPlotExport(false);
    expect(useAppStore.getState().thresholdSettings).toMatchObject({
      enabled: true,
      draftValue: "200",
      applied: { value: 100 },
      showInPreview: false,
      includeInPlotExport: false
    });
    useAppStore.getState().revertThresholdDraft();
    expect(useAppStore.getState().thresholdSettings.draftValue).toBe("100");
    useAppStore.getState().clearThreshold();
    expect(useAppStore.getState().thresholdSettings).toEqual(createDefaultThresholdSettings());
  });

  it("isolates settings by tab and persists every adapter path", () => {
    const firstId = useAppStore.getState().activeAnalysisId;
    useAppStore.getState().setThresholdDraftValue("10");
    useAppStore.getState().applyThresholdDraft();
    useAppStore.getState().setThresholdShowInPreview(false);

    const secondId = useAppStore.getState().createAnalysis("Second");
    expect(useAppStore.getState().thresholdSettings).toEqual(createDefaultThresholdSettings());
    useAppStore.getState().setThresholdDraftValue("20");
    useAppStore.getState().applyThresholdDraft();
    useAppStore.getState().setThresholdIncludeInPlotExport(false);

    useAppStore.getState().switchAnalysis(firstId);
    expect(useAppStore.getState().thresholdSettings).toMatchObject({
      draftValue: "10",
      applied: { value: 10 },
      showInPreview: false,
      includeInPlotExport: true
    });
    useAppStore.getState().switchAnalysis(secondId);
    expect(useAppStore.getState().thresholdSettings).toMatchObject({
      draftValue: "20",
      applied: { value: 20 },
      showInPreview: true,
      includeInPlotExport: false
    });
  });

  it("preserves Threshold on append and resets it on dataset replacement", () => {
    useAppStore.getState().setThresholdDraftValue("50");
    useAppStore.getState().applyThresholdDraft();
    const target = useAppStore.getState();
    const appended = createSyntheticPcrDataset({ specimenLabels: ["Synthetic 2"], reagentLabels: ["R9"] });
    expect(
      target.appendPastedDataset(appended, target.activeAnalysisId, target.runtimeInstanceId, target.revision)
    ).toMatchObject({ ok: true });
    expect(useAppStore.getState().thresholdSettings.applied?.value).toBe(50);

    useAppStore.getState().loadDataset(
      createSyntheticPcrDataset({ specimenLabels: ["Replacement"], reagentLabels: ["R1"] })
    );
    expect(useAppStore.getState().thresholdSettings).toEqual(createDefaultThresholdSettings());
  });

  it("does not advance revision for a rejected apply and advances it for persisted mutations", () => {
    const before = useAppStore.getState().revision;
    expect(useAppStore.getState().setThresholdEnabled(true)).toMatchObject({ ok: false });
    expect(useAppStore.getState().revision).toBe(before);

    useAppStore.getState().setThresholdDraftValue("invalid");
    const afterDraft = useAppStore.getState().revision;
    expect(afterDraft).toBeGreaterThan(before);
    expect(useAppStore.getState().applyThresholdDraft()).toMatchObject({ ok: false });
    expect(useAppStore.getState().revision).toBe(afterDraft);

    useAppStore.getState().setThresholdDraftValue("10");
    useAppStore.getState().applyThresholdDraft();
    const afterApply = useAppStore.getState().revision;
    useAppStore.getState().setThresholdEnabled(false);
    expect(useAppStore.getState().revision).toBeGreaterThan(afterApply);
  });

  it("starts Quick Paste new analysis with defaults and restores the prior tab after close", () => {
    const firstId = useAppStore.getState().activeAnalysisId;
    useAppStore.getState().setThresholdDraftValue("25");
    useAppStore.getState().applyThresholdDraft();
    const target = useAppStore.getState();
    const parsed = parsePastedTable("Synthetic B\nR9\n0\n1\n2", {
      mode: "fullTable",
      sourceName: "Threshold paste"
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = useAppStore
      .getState()
      .openPastedDatasetInNewAnalysis(
        parsed.dataset,
        target.activeAnalysisId,
        target.runtimeInstanceId,
        target.revision
      );
    expect(result.ok).toBe(true);
    const secondId = useAppStore.getState().activeAnalysisId;
    expect(secondId).not.toBe(firstId);
    expect(useAppStore.getState().thresholdSettings).toEqual(createDefaultThresholdSettings());

    useAppStore.getState().closeAnalysis(secondId, { force: true });
    expect(useAppStore.getState().activeAnalysisId).toBe(firstId);
    expect(useAppStore.getState().thresholdSettings.applied?.value).toBe(25);
  });
});
