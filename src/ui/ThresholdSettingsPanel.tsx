import { useMemo, useState } from "react";
import {
  calculateThresholdResults,
  isThresholdDraftApplied,
  parseThresholdInput,
  thresholdResultRequiresReview
} from "../analysis/threshold";
import { formatThresholdValue } from "../chart/thresholdRender";
import type { Curve } from "../data/types";
import { useAppStore } from "../app/appStore";

export function ThresholdSettingsPanel({ curves, hasDataset }: { curves: Curve[]; hasDataset: boolean }) {
  const settings = useAppStore((state) => state.thresholdSettings);
  const setEnabled = useAppStore((state) => state.setThresholdEnabled);
  const setDraftValue = useAppStore((state) => state.setThresholdDraftValue);
  const applyDraft = useAppStore((state) => state.applyThresholdDraft);
  const revertDraft = useAppStore((state) => state.revertThresholdDraft);
  const clearThreshold = useAppStore((state) => state.clearThreshold);
  const setShowInPreview = useAppStore((state) => state.setThresholdShowInPreview);
  const setIncludeInPlotExport = useAppStore((state) => state.setThresholdIncludeInPlotExport);
  const [message, setMessage] = useState<string | null>(null);
  const draftApplied = isThresholdDraftApplied(settings);
  const parsedDraft = parseThresholdInput(settings.draftValue);
  const results = useMemo(
    () =>
      settings.enabled && settings.applied
        ? calculateThresholdResults(curves, settings.applied.value)
        : [],
    [curves, settings.applied, settings.enabled]
  );
  const crossedCount = results.filter((result) => result.outcome === "crossed").length;
  const reviewCount = results.filter(thresholdResultRequiresReview).length;
  const sourceCount = new Set(
    curves.map((curve) => curve.source.sourceInstanceId ?? `${curve.source.fileName}:${curve.source.sheetName}`)
  ).size;

  function handleApply() {
    const result = applyDraft();
    setMessage(result.ok ? "Raw fluorescence Threshold를 적용했습니다." : result.message);
  }

  function handleEnabledChange(enabled: boolean) {
    const result = setEnabled(enabled);
    setMessage(result.ok ? (enabled ? "Threshold 계산을 사용합니다." : "Threshold 계산을 중지했습니다.") : result.message);
  }

  return (
    <section className="threshold-settings" aria-label="Threshold 설정">
      <div className="threshold-setting-row threshold-enable-row">
        <label className="check-control">
          <input
            type="checkbox"
            checked={settings.enabled}
            disabled={!hasDataset || !settings.applied}
            onChange={(event) => handleEnabledChange(event.currentTarget.checked)}
          />
          계산 사용
        </label>
        <span className={`threshold-state-badge${settings.enabled ? " is-active" : ""}`}>
          {settings.enabled ? "Active" : "Off"}
        </span>
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
          onChange={(event) => {
            setDraftValue(event.currentTarget.value);
            setMessage(null);
          }}
        />
      </label>

      <div className="threshold-action-row">
        <button type="button" disabled={!hasDataset || !parsedDraft.ok} onClick={handleApply}>
          적용
        </button>
        <button
          type="button"
          disabled={!settings.applied || draftApplied}
          onClick={() => {
            revertDraft();
            setMessage("마지막 적용값으로 되돌렸습니다.");
          }}
        >
          적용값 복원
        </button>
        <button
          type="button"
          className="threshold-clear-button"
          aria-label="Threshold 초기화"
          title="Threshold 초기화"
          disabled={!settings.applied && settings.draftValue === ""}
          onClick={() => {
            clearThreshold();
            setMessage("Threshold를 초기화했습니다.");
          }}
        >
          ×
        </button>
      </div>

      {settings.applied && (
        <p className="threshold-applied-status">
          적용값: <strong>{formatThresholdValue(settings.applied.value)}</strong>
          {settings.enabled ? " · 원본 fluorescence 기준" : " · 계산 중지"}
        </p>
      )}
      {settings.enabled && settings.applied && !draftApplied && (
        <p className="threshold-mismatch" role="alert">
          입력값이 아직 적용되지 않았습니다. 현재 계산은 {formatThresholdValue(settings.applied.value)}를 사용합니다.
        </p>
      )}

      <div className="threshold-display-options">
        <label className="check-control">
          <input
            type="checkbox"
            checked={settings.showInPreview}
            onChange={(event) => setShowInPreview(event.currentTarget.checked)}
          />
          미리보기 표시
        </label>
        <label className="check-control">
          <input
            type="checkbox"
            checked={settings.includeInPlotExport}
            onChange={(event) => setIncludeInPlotExport(event.currentTarget.checked)}
          />
          Plot Export 포함
        </label>
      </div>

      <p className="threshold-integrity-note">원본 fluorescence 값을 그대로 사용하며 보정·변환하지 않습니다.</p>
      {settings.enabled && (
        <p className="threshold-result-summary">
          선택 {results.length} · 교차 {crossedCount} · 검토 필요 {reviewCount}
        </p>
      )}
      {settings.enabled && sourceCount > 1 && (
        <p className="threshold-source-warning" role="status">
          선택 곡선이 여러 원본 데이터에 걸쳐 있습니다. raw fluorescence 비교 조건을 확인하십시오.
        </p>
      )}
      {message && <p className="threshold-message" role="status">{message}</p>}
    </section>
  );
}
