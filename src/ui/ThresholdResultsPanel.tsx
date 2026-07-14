import { useEffect, useMemo, useState } from "react";
import {
  thresholdResultRequiresReview,
  type ThresholdEvent,
  type ThresholdOutcome,
  type ThresholdResult,
  type ThresholdSourceReference
} from "../analysis/threshold";
import { formatThresholdValue } from "../chart/thresholdRender";
import { copyThresholdResultsExcelTableToClipboard } from "../chart/thresholdClipboard";
import type { LegendItem } from "../chart/chartProjection";
import type { Curve } from "../data/types";
import { LegendSample } from "./CustomLegend";

type ResultFilter = "all" | "crossed" | "review" | "not-reached";

export function ThresholdResultsPanel({
  enabled,
  threshold,
  curves,
  results,
  legendItems,
  onHoverCurve
}: {
  enabled: boolean;
  threshold: number | null;
  curves: Curve[];
  results: ThresholdResult[];
  legendItems: LegendItem[];
  onHoverCurve: (curveId: string | null) => void;
}) {
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [clipboardMessage, setClipboardMessage] = useState("");
  const curvesById = useMemo(() => new Map(curves.map((curve) => [curve.curveId, curve])), [curves]);
  const legendById = useMemo(() => new Map(legendItems.map((item) => [item.curveId, item])), [legendItems]);
  const visibleResults = results.filter((result) => matchesFilter(result, filter));

  useEffect(() => {
    setClipboardMessage("");
  }, [results]);

  async function copyVisibleResults() {
    setClipboardMessage("");
    try {
      await copyThresholdResultsExcelTableToClipboard({ curves, results: visibleResults });
      setClipboardMessage(`${visibleResults.length}개 결과를 복사했습니다.`);
    } catch (error) {
      setClipboardMessage(
        `${error instanceof Error ? error.message : "Threshold 결과를 복사하지 못했습니다."} 브라우저의 클립보드 권한을 확인하십시오.`
      );
    }
  }

  return (
    <details className="threshold-results-panel">
      <summary>
        <span>Threshold 값 검토</span>
        <span>{enabled ? `${results.length} curves` : "Off"}</span>
      </summary>
      <div className="threshold-results-body">
        {!enabled || threshold === null ? (
          <p>Threshold 계산이 비활성 상태입니다.</p>
        ) : results.length === 0 ? (
          <p>현재 선택 곡선이 없습니다.</p>
        ) : (
          <>
            <div className="threshold-results-toolbar">
              <span>적용값 {formatThresholdValue(threshold)} · raw fluorescence</span>
              <div className="threshold-results-actions">
                <label>
                  상태
                  <select
                    aria-label="Threshold 결과 상태 필터"
                    value={filter}
                    onChange={(event) => {
                      setFilter(event.currentTarget.value as ResultFilter);
                      setClipboardMessage("");
                    }}
                  >
                    <option value="all">전체</option>
                    <option value="crossed">교차</option>
                    <option value="review">검토 필요</option>
                    <option value="not-reached">미도달</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="threshold-copy-button"
                  aria-label="현재 표시된 Threshold 결과를 Excel 표로 복사"
                  title="현재 표시된 Threshold 결과를 Excel 표로 복사"
                  disabled={visibleResults.length === 0}
                  onClick={() => void copyVisibleResults()}
                >
                  <span aria-hidden="true">⧉</span>
                </button>
              </div>
            </div>
            {clipboardMessage && (
              <p className="threshold-clipboard-message" role="status">
                {clipboardMessage}
              </p>
            )}
            <div className="threshold-results-list" role="list" aria-label="Threshold 곡선별 결과">
              {visibleResults.map((result) => {
                const curve = curvesById.get(result.curveId);
                const legend = legendById.get(result.curveId);
                if (!curve || !legend) return null;
                const observed = result.firstObservedAtOrAbovePoint;
                return (
                  <details
                    className="threshold-result-row"
                    key={result.curveId}
                    role="listitem"
                    onMouseEnter={() => onHoverCurve(result.curveId)}
                    onMouseLeave={() => onHoverCurve(null)}
                    onFocus={() => onHoverCurve(result.curveId)}
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) onHoverCurve(null);
                    }}
                  >
                    <summary>
                      <LegendSample item={legend} />
                      <span className="threshold-result-label" title={legend.label}>{legend.label}</span>
                      <span>{formatEstimatedCycle(result)}</span>
                      <span>{observed ? `C${formatThresholdValue(observed.x)}` : "-"}</span>
                      <span className={`threshold-outcome threshold-outcome-${outcomeTone(result.outcome)}`}>
                        {formatOutcome(result.outcome)}
                      </span>
                    </summary>
                    <div className="threshold-result-details">
                      <span>원본: {curve.specimenLabel} │ {curve.reagentLabel}</span>
                      <span>최초 관측: {observed ? `Cycle ${formatThresholdValue(observed.x)}, ${formatThresholdValue(observed.y)}` : "없음"}</span>
                      <span>상승 교차 후보: {result.candidateCount}{result.multipleUpwardCrossings ? " (다중 교차 검토)" : ""}</span>
                      <span>결측 구간 event: {result.gapEventCount}</span>
                      <span>규칙: {result.ruleId}</span>
                      <span>Threshold: {formatThresholdValue(result.threshold)} · raw fluorescence</span>
                      <span className="threshold-result-source">
                        출처: {formatSourceIdentity(curve.source.sourceInstanceId, curve.source.fileName, curve.source.sheetName, curve.source.columnLetter)}
                      </span>
                      <ol className="threshold-event-list" aria-label={`${legend.label} Threshold event 근거`}>
                        {result.events.map((event) => (
                          <li className="threshold-event" key={`${result.curveId}-${event.eventIndex}`}>
                            <strong>
                              Event {event.eventIndex + 1} · {formatEventType(event)} · {formatEventRelation(event)}
                            </strong>
                            <span>좌측 원시점: {formatEvidencePoint(event.leftPoint)}</span>
                            <span>우측 원시점: {formatEvidencePoint(event.rightPoint)}</span>
                            <span>결측 index: {formatMissingRange(event)}</span>
                            <span>Cycle-axis 추정: {formatEventEstimate(event)} · 보간 상태 {formatInterpolationStatus(event)}</span>
                            <span>수식 캐시 근거: {event.formulaCacheEvidence ? "사용됨" : "없음"}</span>
                            <span className="threshold-event-sources">
                              셀 출처: {event.sourceReferences.map(formatSourceReference).join(" / ") || "없음"}
                            </span>
                          </li>
                        ))}
                        {result.events.length === 0 && <li className="threshold-event-empty">기록된 교차·결측 event가 없습니다.</li>}
                      </ol>
                    </div>
                  </details>
                );
              })}
              {visibleResults.length === 0 && <p>선택한 상태에 해당하는 결과가 없습니다.</p>}
            </div>
          </>
        )}
      </div>
    </details>
  );
}

function matchesFilter(result: ThresholdResult, filter: ResultFilter) {
  if (filter === "all") return true;
  if (filter === "crossed") return result.outcome === "crossed";
  if (filter === "not-reached") return result.outcome === "not-reached";
  return thresholdResultRequiresReview(result);
}

function formatEvidencePoint(point: ThresholdEvent["leftPoint"]) {
  if (!point) return "없음";
  return `index ${point.index} · Cycle ${formatThresholdValue(point.x)} · fluorescence ${formatThresholdValue(point.y)} · ${point.source.cell}`;
}

function formatMissingRange(event: ThresholdEvent) {
  if (event.missingStartIndex === null || event.missingEndIndex === null) return "없음";
  return event.missingStartIndex === event.missingEndIndex
    ? String(event.missingStartIndex)
    : `${event.missingStartIndex}-${event.missingEndIndex}`;
}

function formatEventEstimate(event: ThresholdEvent) {
  return event.interpolatedCycle === null ? "-" : `C${formatThresholdValue(event.interpolatedCycle)}`;
}

function formatInterpolationStatus(event: ThresholdEvent) {
  const labels: Record<ThresholdEvent["interpolationStatus"], string> = {
    finite: "유효",
    "not-applicable": "해당 없음",
    "non-finite": "계산 불가"
  };
  return labels[event.interpolationStatus];
}

function formatEventType(event: ThresholdEvent) {
  const labels: Record<ThresholdEvent["eventType"], string> = {
    crossing: "상승 교차",
    "indeterminate-leading-gap": "선행 결측",
    "indeterminate-gap": "결측 사이 교차 가능",
    "missing-data": "결측 기록"
  };
  return labels[event.eventType];
}

function formatEventRelation(event: ThresholdEvent) {
  const labels: Record<ThresholdEvent["relation"], string> = {
    primary: "주 결과",
    subsequent: "후속 후보",
    "evidence-only": "근거 기록"
  };
  return labels[event.relation];
}

function formatSourceReference(source: ThresholdSourceReference) {
  return `${source.sourceInstanceId ?? "source-id 없음"} · ${source.sourceName} · ${source.worksheet}!${source.cell} · ${source.formulaCacheStatus}`;
}

function formatSourceIdentity(
  sourceInstanceId: string | undefined,
  sourceName: string,
  worksheet: string,
  columnLetter: string
) {
  return `${sourceInstanceId ?? "source-id 없음"} · ${sourceName} · ${worksheet} · ${columnLetter}열`;
}

function formatEstimatedCycle(result: ThresholdResult) {
  const estimatedCycle = result.primaryEvent?.interpolatedCycle;
  return result.outcome === "crossed" && estimatedCycle !== null && estimatedCycle !== undefined
    ? `C${formatThresholdValue(estimatedCycle)}`
    : "-";
}

function formatOutcome(outcome: ThresholdOutcome) {
  const labels: Record<ThresholdOutcome, string> = {
    crossed: "교차",
    "not-reached": "미도달",
    "starts-at-threshold": "시작점=Threshold",
    "starts-above-threshold": "시작점 초과",
    "indeterminate-leading-gap": "선행 결측",
    "indeterminate-gap": "결측 구간",
    "insufficient-data": "데이터 부족"
  };
  return labels[outcome];
}

function outcomeTone(outcome: ThresholdOutcome) {
  if (outcome === "crossed") return "crossed";
  if (outcome === "not-reached") return "neutral";
  return "review";
}
