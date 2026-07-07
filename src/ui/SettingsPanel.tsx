import { useEffect, useState } from "react";
import type { AxisId, AxisScaleState, ScaleMode, ScalePresetId } from "../chart/chartScale";
import { getAxisAutoDomain, isScalePresetConfigured } from "../chart/chartScale";
import { builtInStylePresets, defaultChartColors } from "../chart/chartStyle";
import { buildPcrChartOption } from "../chart/chartConfig";
import { copyPngBlobToClipboard, downloadBlob, exportChartImageBlob } from "../chart/exportChart";
import type { ImageExportType } from "../chart/exportFilenames";
import { createImageExportFileName, createPlottedDataFileName } from "../chart/exportFilenames";
import { createPlottedDataCsv } from "../chart/plottedDataExport";
import { useAppStore } from "../app/appStore";
import { formatCurveLabel } from "../data/curveLabels";
import type { Curve, CurveStyleOverride, GroupingMode, LineType, MarkerType, StyleGroupingTarget } from "../data/types";

export function SettingsPanel() {
  const chartScale = useAppStore((state) => state.chartScale);
  const dataset = useAppStore((state) => state.dataset);
  const selection = useAppStore((state) => state.selection);
  const styleRules = useAppStore((state) => state.styleRules);
  const curveOverrides = useAppStore((state) => state.curveOverrides);
  const exportCounter = useAppStore((state) => state.exportCounter);
  const exportMessage = useAppStore((state) => state.exportMessage);
  const lastPresetMessage = useAppStore((state) => state.lastPresetMessage);
  const canUndoPreset = useAppStore((state) => Boolean(state.lastPresetUndo));
  const setAxisScaleMode = useAppStore((state) => state.setAxisScaleMode);
  const setAxisFixedValue = useAppStore((state) => state.setAxisFixedValue);
  const setAxisPresetValue = useAppStore((state) => state.setAxisPresetValue);
  const setStyleGroupingTarget = useAppStore((state) => state.setStyleGroupingTarget);
  const setGroupColor = useAppStore((state) => state.setGroupColor);
  const setGroupLineType = useAppStore((state) => state.setGroupLineType);
  const setCurveOverride = useAppStore((state) => state.setCurveOverride);
  const applyStylePreset = useAppStore((state) => state.applyStylePreset);
  const undoLastPreset = useAppStore((state) => state.undoLastPreset);
  const moveCurveOrder = useAppStore((state) => state.moveCurveOrder);
  const markExportSuccess = useAppStore((state) => state.markExportSuccess);
  const setExportMessage = useAppStore((state) => state.setExportMessage);
  const labelMode = selection?.groupingMode ?? "reagent";
  const selectedCurves = getSelectedCurves(dataset, selection?.selectedCurveIds ?? new Set<string>(), selection?.orderedCurveIds);
  const xAutoDomain = getAxisAutoDomain("x", selectedCurves);
  const yAutoDomain = getAxisAutoDomain("y", selectedCurves);
  const specimenDefaultColors = createDefaultEntityColorMap(dataset?.specimens ?? []);
  const reagentDefaultColors = createDefaultEntityColorMap(dataset?.reagents ?? []);

  return (
    <div className="settings-accordion">
      <details open>
        <summary>Scale</summary>
        <ScaleAxisControl
          axis="x"
          label="X axis"
          state={chartScale.x}
          autoDomain={xAutoDomain}
          onModeChange={setAxisScaleMode}
          onFixedValueChange={setAxisFixedValue}
          onPresetValueChange={setAxisPresetValue}
        />
        <ScaleAxisControl
          axis="y"
          label="Y axis"
          state={chartScale.y}
          autoDomain={yAutoDomain}
          onModeChange={setAxisScaleMode}
          onFixedValueChange={setAxisFixedValue}
          onPresetValueChange={setAxisPresetValue}
        />
      </details>
      <details>
        <summary>Style</summary>
        <section className="style-settings">
          <div className="style-target-grid">
            <label>
              색상 기준
              <select
                value={styleRules.colorBy}
                onChange={(event) => setStyleGroupingTarget("colorBy", event.currentTarget.value as StyleGroupingTarget)}
              >
                <option value="reagent">시약별</option>
                <option value="specimen">검체별</option>
              </select>
            </label>
            <label>
              선 기준
              <select
                value={styleRules.lineTypeBy}
                onChange={(event) => setStyleGroupingTarget("lineTypeBy", event.currentTarget.value as StyleGroupingTarget)}
              >
                <option value="reagent">시약별</option>
                <option value="specimen">검체별</option>
              </select>
            </label>
          </div>

          <GroupStyleEditor
            title="검체 스타일"
            target="specimen"
            entities={dataset?.specimens ?? []}
            colorRules={styleRules.specimenColors}
            defaultColors={specimenDefaultColors}
            lineRules={styleRules.specimenLineTypes}
            onColorChange={setGroupColor}
            onLineTypeChange={setGroupLineType}
          />
          <GroupStyleEditor
            title="시약 스타일"
            target="reagent"
            entities={dataset?.reagents ?? []}
            colorRules={styleRules.reagentColors}
            defaultColors={reagentDefaultColors}
            lineRules={styleRules.reagentLineTypes}
            onColorChange={setGroupColor}
            onLineTypeChange={setGroupLineType}
          />

          <div className="preset-row">
            {builtInStylePresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={selectedCurves.length === 0}
                onClick={() => applyStylePreset(preset.id, selectedCurves.map((curve) => curve.curveId))}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="preset-status">
            <span>{lastPresetMessage ?? "Preset은 선택된 curve의 개별 스타일을 덮어씁니다."}</span>
            <button type="button" disabled={!canUndoPreset} onClick={undoLastPreset}>
              Undo
            </button>
          </div>

          <IndividualCurveEditor
            curves={selectedCurves}
            labelMode={labelMode}
            styleRules={styleRules}
            specimenDefaultColors={specimenDefaultColors}
            reagentDefaultColors={reagentDefaultColors}
            overrides={curveOverrides}
            onOverride={setCurveOverride}
          />
        </section>
      </details>
      <details>
        <summary>Legend Order</summary>
        <LegendOrderEditor curves={selectedCurves} labelMode={labelMode} onMove={moveCurveOrder} />
      </details>
      <details>
        <summary>Export</summary>
        <ExportControls
          dataset={dataset}
          selectedCurves={selectedCurves}
          selectedCurveIds={selection?.selectedCurveIds ?? new Set<string>()}
          orderedCurveIds={selection?.orderedCurveIds}
          chartScale={chartScale}
          labelMode={labelMode}
          styleRules={styleRules}
          curveOverrides={curveOverrides}
          exportCounter={exportCounter}
          exportMessage={exportMessage}
          markExportSuccess={markExportSuccess}
          setExportMessage={setExportMessage}
        />
      </details>
    </div>
  );
}

function ExportControls({
  dataset,
  selectedCurves,
  selectedCurveIds,
  orderedCurveIds,
  chartScale,
  labelMode,
  styleRules,
  curveOverrides,
  exportCounter,
  exportMessage,
  markExportSuccess,
  setExportMessage
}: {
  dataset: ReturnType<typeof useAppStore.getState>["dataset"];
  selectedCurves: Curve[];
  selectedCurveIds: Set<string>;
  orderedCurveIds?: string[];
  chartScale: ReturnType<typeof useAppStore.getState>["chartScale"];
  labelMode: GroupingMode;
  styleRules: ReturnType<typeof useAppStore.getState>["styleRules"];
  curveOverrides: ReturnType<typeof useAppStore.getState>["curveOverrides"];
  exportCounter: number;
  exportMessage: string | null;
  markExportSuccess: (message: string) => void;
  setExportMessage: (message: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const csvResult = createPlottedDataCsv({ curves: selectedCurves, labelMode, styleRules, curveOverrides });
  const disabled = selectedCurves.length === 0 || busy;

  async function exportImage(type: ImageExportType) {
    if (!dataset) return;
    setBusy(true);
    setExportMessage(null);
    try {
      const chart = buildPcrChartOption({
        dataset,
        selectedCurveIds,
        orderedCurveIds,
        scale: chartScale,
        labelMode,
        styleRules,
        curveOverrides
      });
      const blob = await exportChartImageBlob({ option: chart.option, type });
      const fileName = createImageExportFileName(exportCounter, type);
      downloadBlob(blob, fileName);
      markExportSuccess(`Saved ${fileName}.`);
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "Image export failed.");
    } finally {
      setBusy(false);
    }
  }

  async function copyPng() {
    if (!dataset) return;
    setBusy(true);
    setExportMessage(null);
    try {
      const chart = buildPcrChartOption({
        dataset,
        selectedCurveIds,
        orderedCurveIds,
        scale: chartScale,
        labelMode,
        styleRules,
        curveOverrides
      });
      const blob = await exportChartImageBlob({ option: chart.option, type: "png" });
      await copyPngBlobToClipboard(blob);
      setExportMessage("Copied PNG image to clipboard.");
    } catch (error) {
      setExportMessage(`${error instanceof Error ? error.message : "Clipboard copy failed."} Download PNG instead.`);
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    if (!csvResult.ok) {
      setExportMessage(csvResult.reason);
      return;
    }

    const fileName = createPlottedDataFileName(exportCounter);
    const blob = new Blob(["\ufeff", csvResult.csv], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, fileName);
    markExportSuccess(`Saved ${fileName}.`);
  }

  return (
    <section className="export-controls">
      <p>다음 파일 번호: plot{exportCounter}</p>
      <button type="button" disabled={disabled} onClick={() => void exportImage("png")}>
        PNG 저장
      </button>
      <button type="button" disabled={disabled} onClick={() => void exportImage("jpeg")}>
        JPEG 저장
      </button>
      <button type="button" disabled={disabled} onClick={() => void copyPng()}>
        클립보드 PNG
      </button>
      <button type="button" disabled={busy || !csvResult.ok} onClick={exportCsv}>
        Plotted CSV
      </button>
      {!csvResult.ok && <p>{csvResult.reason}</p>}
      {exportMessage && <p className="export-message">{exportMessage}</p>}
    </section>
  );
}

function GroupStyleEditor({
  title,
  target,
  entities,
  colorRules,
  defaultColors,
  lineRules,
  onColorChange,
  onLineTypeChange
}: {
  title: string;
  target: StyleGroupingTarget;
  entities: Array<{ id: string; label: string }>;
  colorRules: Record<string, string>;
  defaultColors: Record<string, string>;
  lineRules: Record<string, LineType>;
  onColorChange: (target: StyleGroupingTarget, entityId: string, color: string) => void;
  onLineTypeChange: (target: StyleGroupingTarget, entityId: string, lineType: LineType) => void;
}) {
  const visibleEntities = entities.slice(0, 16);

  return (
    <section className="group-style-editor" aria-label={title}>
      <strong>{title}</strong>
      {visibleEntities.length === 0 && <p>데이터 업로드 후 설정할 수 있습니다.</p>}
      {visibleEntities.map((entity) => (
        <div className="style-row" key={entity.id}>
          <span title={entity.label}>{entity.label || "Empty label"}</span>
          <input
            type="color"
            aria-label={`${entity.label} color`}
            value={colorRules[entity.id] ?? defaultColors[entity.id] ?? defaultChartColors[0]}
            onChange={(event) => onColorChange(target, entity.id, event.currentTarget.value)}
          />
          <HexColorInput
            label={`${entity.label} hex color`}
            value={colorRules[entity.id] ?? defaultColors[entity.id] ?? defaultChartColors[0]}
            onCommit={(color) => onColorChange(target, entity.id, color)}
          />
          <select
            aria-label={`${entity.label} line type`}
            value={lineRules[entity.id] ?? "solid"}
            onChange={(event) => onLineTypeChange(target, entity.id, event.currentTarget.value as LineType)}
          >
            <option value="solid">실선</option>
            <option value="dashed">점선</option>
            <option value="dotted">도트</option>
          </select>
        </div>
      ))}
      {entities.length > visibleEntities.length && <p>{entities.length - visibleEntities.length}개 항목은 검색/선택 범위 축소 후 조정합니다.</p>}
    </section>
  );
}

function IndividualCurveEditor({
  curves,
  labelMode,
  styleRules,
  specimenDefaultColors,
  reagentDefaultColors,
  overrides,
  onOverride
}: {
  curves: Curve[];
  labelMode: GroupingMode;
  styleRules: ReturnType<typeof useAppStore.getState>["styleRules"];
  specimenDefaultColors: Record<string, string>;
  reagentDefaultColors: Record<string, string>;
  overrides: Record<string, CurveStyleOverride>;
  onOverride: (curveId: string, override: CurveStyleOverride) => void;
}) {
  const visibleCurves = curves.slice(0, 30);

  return (
    <section className="individual-editor" aria-label="개별 curve 스타일">
      <strong>개별 curve</strong>
      {visibleCurves.length === 0 && <p>선택된 curve가 없습니다.</p>}
      {visibleCurves.map((curve) => (
        <div className="individual-row" key={curve.curveId}>
          <input
            type="text"
            aria-label={`${formatCurveLabel(curve, labelMode)} legend name`}
            value={overrides[curve.curveId]?.displayName ?? ""}
            placeholder={formatCurveLabel(curve, labelMode)}
            onChange={(event) => onOverride(curve.curveId, { displayName: event.currentTarget.value || undefined })}
          />
          <input
            type="color"
            aria-label={`${formatCurveLabel(curve, labelMode)} color`}
            value={overrides[curve.curveId]?.color ?? getCurveDefaultColor(curve, styleRules, specimenDefaultColors, reagentDefaultColors)}
            onChange={(event) => onOverride(curve.curveId, { color: event.currentTarget.value })}
          />
          <HexColorInput
            label={`${formatCurveLabel(curve, labelMode)} hex color`}
            value={overrides[curve.curveId]?.color ?? getCurveDefaultColor(curve, styleRules, specimenDefaultColors, reagentDefaultColors)}
            onCommit={(color) => onOverride(curve.curveId, { color })}
          />
          <select
            aria-label={`${formatCurveLabel(curve, labelMode)} line type`}
            value={overrides[curve.curveId]?.lineType ?? getCurveDefaultLineType(curve, styleRules)}
            onChange={(event) => onOverride(curve.curveId, { lineType: event.currentTarget.value as LineType })}
          >
            <option value="solid">실선</option>
            <option value="dashed">점선</option>
            <option value="dotted">도트</option>
          </select>
          <select
            aria-label={`${formatCurveLabel(curve, labelMode)} marker type`}
            value={overrides[curve.curveId]?.markerType ?? "none"}
            onChange={(event) => onOverride(curve.curveId, { markerType: event.currentTarget.value as MarkerType })}
          >
            <option value="none">없음</option>
            <option value="circle">원형</option>
            <option value="triangle">세모</option>
            <option value="rect">네모</option>
          </select>
        </div>
      ))}
      {curves.length > visibleCurves.length && <p>{curves.length - visibleCurves.length}개 선택 curve는 현재 목록에서 생략되었습니다.</p>}
    </section>
  );
}

function HexColorInput({
  label,
  value,
  onCommit
}: {
  label: string;
  value: string;
  onCommit: (color: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const normalizedValue = normalizeHexColor(value) ?? defaultChartColors[0];

  useEffect(() => {
    setDraft(normalizedValue);
  }, [normalizedValue]);

  function updateDraft(nextValue: string) {
    setDraft(nextValue);
    const normalized = isSixDigitHexColor(nextValue) ? normalizeHexColor(nextValue) : null;
    if (normalized) {
      onCommit(normalized);
    }
  }

  function commitDraft() {
    const normalized = normalizeHexColor(draft);
    if (normalized) {
      onCommit(normalized);
    }
    setDraft(normalized ?? normalizedValue);
  }

  return (
    <input
      className="hex-input"
      type="text"
      inputMode="text"
      spellCheck={false}
      aria-label={label}
      value={draft}
      onChange={(event) => updateDraft(event.currentTarget.value)}
      onBlur={commitDraft}
    />
  );
}

function LegendOrderEditor({
  curves,
  labelMode,
  onMove
}: {
  curves: Curve[];
  labelMode: GroupingMode;
  onMove: (curveId: string, direction: "up" | "down") => void;
}) {
  return (
    <div className="legend-order-list">
      {curves.length === 0 && <p>선택된 curve가 없습니다.</p>}
      {curves.map((curve, index) => (
        <div className="legend-order-row" key={curve.curveId}>
          <span>{formatCurveLabel(curve, labelMode)}</span>
          <button type="button" aria-label={`${formatCurveLabel(curve, labelMode)} move up`} disabled={index === 0} onClick={() => onMove(curve.curveId, "up")}>
            ↑
          </button>
          <button
            type="button"
            aria-label={`${formatCurveLabel(curve, labelMode)} move down`}
            disabled={index === curves.length - 1}
            onClick={() => onMove(curve.curveId, "down")}
          >
            ↓
          </button>
        </div>
      ))}
    </div>
  );
}

function getSelectedCurves(dataset: ReturnType<typeof useAppStore.getState>["dataset"], selectedCurveIds: Set<string>, orderedCurveIds?: string[]) {
  if (!dataset) return [];
  const curvesById = new Map(dataset.curves.map((curve) => [curve.curveId, curve]));
  return (orderedCurveIds ?? dataset.orderedCurveIds)
    .filter((curveId) => selectedCurveIds.has(curveId))
    .map((curveId) => curvesById.get(curveId))
    .filter((curve): curve is Curve => Boolean(curve));
}

function createDefaultEntityColorMap(entities: Array<{ id: string }>) {
  return Object.fromEntries(entities.map((entity, index) => [entity.id, defaultChartColors[index % defaultChartColors.length]]));
}

function getCurveDefaultColor(
  curve: Curve,
  styleRules: ReturnType<typeof useAppStore.getState>["styleRules"],
  specimenDefaultColors: Record<string, string>,
  reagentDefaultColors: Record<string, string>
) {
  if (styleRules.colorBy === "specimen") {
    return styleRules.specimenColors[curve.specimenId] ?? specimenDefaultColors[curve.specimenId] ?? defaultChartColors[0];
  }

  return styleRules.reagentColors[curve.reagentId] ?? reagentDefaultColors[curve.reagentId] ?? defaultChartColors[0];
}

function getCurveDefaultLineType(curve: Curve, styleRules: ReturnType<typeof useAppStore.getState>["styleRules"]): LineType {
  if (styleRules.lineTypeBy === "specimen") {
    return styleRules.specimenLineTypes[curve.specimenId] ?? "solid";
  }

  return styleRules.reagentLineTypes[curve.reagentId] ?? "solid";
}

function normalizeHexColor(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/iu);
  if (!match) return null;

  const hex = match[1].toLowerCase();
  if (hex.length === 3) {
    return `#${hex.split("").map((character) => `${character}${character}`).join("")}`;
  }

  return `#${hex}`;
}

function isSixDigitHexColor(value: string) {
  return /^#?[0-9a-f]{6}$/iu.test(value.trim());
}

function ScaleAxisControl({
  axis,
  label,
  state,
  autoDomain,
  onModeChange,
  onFixedValueChange,
  onPresetValueChange
}: {
  axis: AxisId;
  label: string;
  state: AxisScaleState;
  autoDomain: { min: number; max: number } | null;
  onModeChange: (axis: AxisId, mode: ScaleMode) => void;
  onFixedValueChange: (axis: AxisId, bound: "min" | "max", value: string) => void;
  onPresetValueChange: (axis: AxisId, preset: ScalePresetId, field: "label" | "min" | "max", value: string) => void;
}) {
  const fixedInvalid = state.mode === "fixed" && !isValidFixedScale(state);
  const autoMin = autoDomain ? formatDomainValue(autoDomain.min) : "";
  const autoMax = autoDomain ? formatDomainValue(autoDomain.max) : "";
  const preset1Ready = isScalePresetConfigured(state.preset1);
  const preset2Ready = isScalePresetConfigured(state.preset2);

  return (
    <section className="scale-axis" aria-label={label}>
      <div className="scale-axis-header">
        <strong>{label}</strong>
      </div>
      <p className="scale-auto-domain">
        Auto range: {autoDomain ? `${autoMin} - ${autoMax}` : "선택된 데이터 없음"}
      </p>
      <div className="scale-mode-grid" role="radiogroup" aria-label={`${label} scale mode`}>
        <ScaleModeButton label="Auto" active={state.mode === "auto"} onClick={() => onModeChange(axis, "auto")} />
        <ScaleModeButton label="Fixed" active={state.mode === "fixed"} onClick={() => onModeChange(axis, "fixed")} />
        <ScaleModeButton
          label={state.preset1?.label?.trim() || "P1"}
          active={state.mode === "preset1"}
          disabled={!preset1Ready}
          onClick={() => onModeChange(axis, "preset1")}
        />
        <ScaleModeButton
          label={state.preset2?.label?.trim() || "P2"}
          active={state.mode === "preset2"}
          disabled={!preset2Ready}
          onClick={() => onModeChange(axis, "preset2")}
        />
      </div>
      {state.mode === "fixed" && (
        <>
          <div className="fixed-scale-grid">
            <label>
              Min
              <input
                type="number"
                value={state.fixedMin}
                placeholder={autoMin}
                onChange={(event) => onFixedValueChange(axis, "min", event.currentTarget.value)}
              />
            </label>
            <label>
              Max
              <input
                type="number"
                value={state.fixedMax}
                placeholder={autoMax}
                onChange={(event) => onFixedValueChange(axis, "max", event.currentTarget.value)}
              />
            </label>
          </div>
          <button
            type="button"
            className="scale-fill-button"
            disabled={!autoDomain}
            onClick={() => {
              onFixedValueChange(axis, "min", autoMin);
              onFixedValueChange(axis, "max", autoMax);
            }}
          >
            현재 Auto값 적용
          </button>
        </>
      )}
      <div className="scale-preset-editor" aria-label={`${label} preset editor`}>
        <ScalePresetEditor
          axis={axis}
          presetId="preset1"
          fallbackLabel="P1"
          state={state}
          onPresetValueChange={onPresetValueChange}
        />
        <ScalePresetEditor
          axis={axis}
          presetId="preset2"
          fallbackLabel="P2"
          state={state}
          onPresetValueChange={onPresetValueChange}
        />
      </div>
      {state.mode === "preset1" && !preset1Ready && <p>Preset P1에는 숫자 min &lt; max가 필요합니다.</p>}
      {state.mode === "preset2" && !preset2Ready && <p>Preset P2에는 숫자 min &lt; max가 필요합니다.</p>}
      {fixedInvalid && <p className="error-text">숫자 min &lt; max가 필요합니다.</p>}
    </section>
  );
}

function ScalePresetEditor({
  axis,
  presetId,
  fallbackLabel,
  state,
  onPresetValueChange
}: {
  axis: AxisId;
  presetId: ScalePresetId;
  fallbackLabel: string;
  state: AxisScaleState;
  onPresetValueChange: (axis: AxisId, preset: ScalePresetId, field: "label" | "min" | "max", value: string) => void;
}) {
  const preset = state[presetId] ?? { label: fallbackLabel, min: "", max: "" };

  return (
    <div className="scale-preset-row">
      <input
        type="text"
        aria-label={`${axis} ${fallbackLabel} label`}
        value={preset.label}
        onChange={(event) => onPresetValueChange(axis, presetId, "label", event.currentTarget.value)}
      />
      <input
        type="number"
        aria-label={`${axis} ${fallbackLabel} min`}
        placeholder="min"
        value={preset.min}
        onChange={(event) => onPresetValueChange(axis, presetId, "min", event.currentTarget.value)}
      />
      <input
        type="number"
        aria-label={`${axis} ${fallbackLabel} max`}
        placeholder="max"
        value={preset.max}
        onChange={(event) => onPresetValueChange(axis, presetId, "max", event.currentTarget.value)}
      />
    </div>
  );
}

function ScaleModeButton({
  label,
  active,
  disabled,
  onClick
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" aria-pressed={active} className={active ? "is-active" : ""} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}

function isValidFixedScale(state: AxisScaleState) {
  const min = Number(state.fixedMin);
  const max = Number(state.fixedMax);
  return state.fixedMin.trim() !== "" && state.fixedMax.trim() !== "" && Number.isFinite(min) && Number.isFinite(max) && min < max;
}

function formatDomainValue(value: number) {
  if (value === 0) return "0";
  const absValue = Math.abs(value);
  if (absValue >= 0.001 && absValue < 100000) {
    return Number(value.toPrecision(6)).toString();
  }
  return value.toExponential(3);
}
