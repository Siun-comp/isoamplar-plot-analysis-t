import { useMemo, useState } from "react";
import {
  calculateConfiguredThresholdResults,
  createDefaultReagentThresholdSetting,
  hasActiveThresholdForCurves,
  isReagentThresholdDraftApplied,
  isThresholdDraftApplied,
  parseThresholdInput,
  thresholdResultRequiresReview
} from "../analysis/threshold";
import { formatThresholdValue } from "../chart/thresholdRender";
import type { Curve, PcrEntity } from "../data/types";
import { useAppStore } from "../app/appStore";

export function ThresholdSettingsPanel({
  curves,
  reagents,
  hasDataset
}: {
  curves: Curve[];
  reagents: PcrEntity[];
  hasDataset: boolean;
}) {
  const settings = useAppStore((state) => state.thresholdSettings);
  const setMode = useAppStore((state) => state.setThresholdMode);
  const setEnabled = useAppStore((state) => state.setThresholdEnabled);
  const setDraftValue = useAppStore((state) => state.setThresholdDraftValue);
  const applyDraft = useAppStore((state) => state.applyThresholdDraft);
  const revertDraft = useAppStore((state) => state.revertThresholdDraft);
  const clearThreshold = useAppStore((state) => state.clearThreshold);
  const setReagentEnabled = useAppStore((state) => state.setReagentThresholdEnabled);
  const setReagentDraftValue = useAppStore((state) => state.setReagentThresholdDraftValue);
  const applyAllReagentDrafts = useAppStore((state) => state.applyAllReagentThresholdDrafts);
  const revertAllReagentDrafts = useAppStore((state) => state.revertAllReagentThresholdDrafts);
  const clearAllReagentThresholds = useAppStore((state) => state.clearAllReagentThresholds);
  const setShowInPreview = useAppStore((state) => state.setThresholdShowInPreview);
  const setIncludeInPlotExport = useAppStore((state) => state.setThresholdIncludeInPlotExport);
  const [message, setMessage] = useState<string | null>(null);
  const results = useMemo(
    () => calculateConfiguredThresholdResults(curves, settings),
    [curves, settings]
  );
  const active = hasActiveThresholdForCurves(settings, curves);
  const crossedCount = results.filter((result) => result.outcome === "crossed").length;
  const reviewCount = results.filter(thresholdResultRequiresReview).length;
  const sourceCount = new Set(
    curves.map((curve) => curve.source.sourceInstanceId ?? `${curve.source.fileName}:${curve.source.sheetName}`)
  ).size;

  return (
    <section className="threshold-settings" aria-label="Threshold 설정">
      <div className="threshold-mode-control" role="group" aria-label="Threshold 적용 기준">
        <button
          type="button"
          className={settings.mode === "common" ? "is-active" : ""}
          aria-pressed={settings.mode === "common"}
          onClick={() => setMode("common")}
        >
          공통
        </button>
        <button
          type="button"
          className={settings.mode === "perReagent" ? "is-active" : ""}
          aria-pressed={settings.mode === "perReagent"}
          onClick={() => setMode("perReagent")}
        >
          시약별
        </button>
      </div>

      {settings.mode === "common" ? (
        <CommonThresholdEditor
          hasDataset={hasDataset}
          settings={settings}
          setEnabled={setEnabled}
          setDraftValue={setDraftValue}
          applyDraft={applyDraft}
          revertDraft={revertDraft}
          clearThreshold={clearThreshold}
          setMessage={setMessage}
        />
      ) : (
        <div className="reagent-threshold-list" aria-label="시약별 Threshold 목록">
          <div className="reagent-threshold-header" aria-hidden="true">
            <span>사용</span><span>시약</span><span>Raw Threshold</span><span>상태</span>
          </div>
          {reagents.map((reagent) => {
            const setting = settings.reagentSettings[reagent.id] ?? createDefaultReagentThresholdSetting();
            const draftApplied = isReagentThresholdDraftApplied(setting);
            const parsed = parseThresholdInput(setting.draftValue);
            return (
              <div className="reagent-threshold-row" key={reagent.id}>
                <input
                  type="checkbox"
                  aria-label={`${reagent.label} Threshold 계산 사용`}
                  checked={setting.enabled}
                  disabled={!setting.applied}
                  onChange={(event) => {
                    const result = setReagentEnabled(reagent.id, event.currentTarget.checked);
                    setMessage(result.ok ? `${reagent.label} Threshold 상태를 변경했습니다.` : result.message);
                  }}
                />
                <span className="reagent-threshold-name" title={reagent.label}>{reagent.label}</span>
                <div className="reagent-threshold-input-wrap">
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label={`${reagent.label} Raw fluorescence Threshold`}
                    placeholder="예: 2.5e5"
                    value={setting.draftValue}
                    onChange={(event) => {
                      setReagentDraftValue(reagent.id, event.currentTarget.value);
                      setMessage(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      const result = applyAllReagentDrafts(reagents.map((item) => item.id));
                      setMessage(result.ok ? "시약별 Threshold를 모두 적용했습니다." : result.message);
                    }}
                  />
                  {setting.applied && !draftApplied && <span className="reagent-threshold-dirty" title="입력값 미적용">*</span>}
                </div>
                <span className={`reagent-threshold-status ${getReagentThresholdStatusClass(setting, parsed.ok, draftApplied)}`}>
                  {getReagentThresholdStatus(setting, parsed.ok, draftApplied)}
                </span>
              </div>
            );
          })}
          {reagents.length === 0 && <p>시약 데이터가 없습니다.</p>}
          <div className="reagent-threshold-bulk-actions">
            <button type="button" onClick={() => {
              const result = applyAllReagentDrafts(reagents.map((reagent) => reagent.id));
              setMessage(result.ok ? "시약별 Threshold를 모두 적용했습니다." : result.message);
            }}>모두 적용</button>
            <button type="button" onClick={() => {
              revertAllReagentDrafts(reagents.map((reagent) => reagent.id));
              setMessage("모든 입력값을 마지막 적용값으로 복원했습니다.");
            }}>적용값 복원</button>
            <button type="button" onClick={() => {
              clearAllReagentThresholds(reagents.map((reagent) => reagent.id));
              setMessage("시약별 Threshold를 모두 초기화했습니다.");
            }}>전체 초기화</button>
          </div>
        </div>
      )}

      <div className="threshold-display-options">
        <label className="check-control">
          <input type="checkbox" checked={settings.showInPreview} onChange={(event) => setShowInPreview(event.currentTarget.checked)} />
          미리보기 표시
        </label>
        <label className="check-control">
          <input type="checkbox" checked={settings.includeInPlotExport} onChange={(event) => setIncludeInPlotExport(event.currentTarget.checked)} />
          Plot Export 포함
        </label>
      </div>

      <p className="threshold-integrity-note">원본 fluorescence 값을 그대로 사용하며 보정·변환하지 않습니다.</p>
      {active && <p className="threshold-result-summary">선택 {results.length} · Positive {crossedCount} · 검토 필요 {reviewCount}</p>}
      {active && sourceCount > 1 && (
        <p className="threshold-source-warning" role="status">선택 곡선이 여러 원본 데이터에 걸쳐 있습니다. raw fluorescence 비교 조건을 확인하십시오.</p>
      )}
      {message && <p className="threshold-message" role="status">{message}</p>}
    </section>
  );
}

function getReagentThresholdStatus(
  setting: ReturnType<typeof createDefaultReagentThresholdSetting>,
  parsed: boolean,
  draftApplied: boolean
) {
  if (!setting.applied && !setting.draftValue.trim()) return "미설정";
  if (!parsed) return "입력 오류";
  if (setting.applied && !draftApplied) return "변경됨";
  return setting.enabled ? "적용됨" : "중지";
}

function getReagentThresholdStatusClass(
  setting: ReturnType<typeof createDefaultReagentThresholdSetting>,
  parsed: boolean,
  draftApplied: boolean
) {
  const status = getReagentThresholdStatus(setting, parsed, draftApplied);
  if (status === "적용됨") return "is-applied";
  if (status === "변경됨" || status === "입력 오류") return "is-warning";
  return "is-muted";
}

function CommonThresholdEditor({
  hasDataset,
  settings,
  setEnabled,
  setDraftValue,
  applyDraft,
  revertDraft,
  clearThreshold,
  setMessage
}: {
  hasDataset: boolean;
  settings: ReturnType<typeof useAppStore.getState>["thresholdSettings"];
  setEnabled: ReturnType<typeof useAppStore.getState>["setThresholdEnabled"];
  setDraftValue: ReturnType<typeof useAppStore.getState>["setThresholdDraftValue"];
  applyDraft: ReturnType<typeof useAppStore.getState>["applyThresholdDraft"];
  revertDraft: ReturnType<typeof useAppStore.getState>["revertThresholdDraft"];
  clearThreshold: ReturnType<typeof useAppStore.getState>["clearThreshold"];
  setMessage: (message: string | null) => void;
}) {
  const draftApplied = isThresholdDraftApplied(settings);
  const parsedDraft = parseThresholdInput(settings.draftValue);
  return <>
    <div className="threshold-setting-row threshold-enable-row">
      <label className="check-control">
        <input
          type="checkbox"
          checked={settings.enabled}
          disabled={!hasDataset || !settings.applied}
          onChange={(event) => {
            const result = setEnabled(event.currentTarget.checked);
            setMessage(result.ok ? (event.currentTarget.checked ? "Threshold 계산을 사용합니다." : "Threshold 계산을 중지했습니다.") : result.message);
          }}
        />
        계산 사용
      </label>
      <span className={`threshold-state-badge${settings.enabled ? " is-active" : ""}`}>{settings.enabled ? "Active" : "Off"}</span>
    </div>
    <label className="threshold-value-field">
      <span>Raw fluorescence Threshold</span>
      <input
        type="text"
        inputMode="decimal"
        aria-label="Raw fluorescence Threshold"
        placeholder="예: 250000 또는 2.5e5"
        value={settings.draftValue}
        disabled={!hasDataset}
        onChange={(event) => { setDraftValue(event.currentTarget.value); setMessage(null); }}
      />
    </label>
    <div className="threshold-action-row">
      <button type="button" disabled={!hasDataset || !parsedDraft.ok} onClick={() => {
        const result = applyDraft();
        setMessage(result.ok ? "Raw fluorescence Threshold를 적용했습니다." : result.message);
      }}>적용</button>
      <button type="button" disabled={!settings.applied || draftApplied} onClick={() => { revertDraft(); setMessage("마지막 적용값으로 되돌렸습니다."); }}>적용값 복원</button>
      <button type="button" className="threshold-clear-button" aria-label="Threshold 초기화" title="Threshold 초기화" disabled={!settings.applied && settings.draftValue === ""} onClick={() => { clearThreshold(); setMessage("Threshold를 초기화했습니다."); }}>×</button>
    </div>
    {settings.applied && <p className="threshold-applied-status">적용값: <strong>{formatThresholdValue(settings.applied.value)}</strong>{settings.enabled ? " · 원본 fluorescence 기준" : " · 계산 중지"}</p>}
    {settings.enabled && settings.applied && !draftApplied && <p className="threshold-mismatch" role="alert">입력값이 아직 적용되지 않았습니다. 현재 계산은 {formatThresholdValue(settings.applied.value)}를 사용합니다.</p>}
  </>;
}
