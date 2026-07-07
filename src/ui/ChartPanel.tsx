import { lazy, Suspense } from "react";
import { useAppStore } from "../app/appStore";
import { buildPcrChartOption } from "../chart/chartConfig";
import { hasVisibleCurveWarning } from "../chart/chartScale";

const LazyChartView = lazy(() => import("../chart/ChartView").then((module) => ({ default: module.ChartView })));

export function ChartPanel() {
  const dataset = useAppStore((state) => state.dataset);
  const selection = useAppStore((state) => state.selection);
  const chartScale = useAppStore((state) => state.chartScale);
  const styleRules = useAppStore((state) => state.styleRules);
  const curveOverrides = useAppStore((state) => state.curveOverrides);
  const setSelectionFilter = useAppStore((state) => state.setSelectionFilter);
  const buildResult = buildPcrChartOption({
    dataset,
    selectedCurveIds: selection?.selectedCurveIds ?? new Set<string>(),
    orderedCurveIds: selection?.orderedCurveIds,
    scale: chartScale,
    labelMode: selection?.groupingMode,
    styleRules,
    curveOverrides
  });
  const selectedCount = buildResult.visibleCurves.length;

  return (
    <section className="chart-stage" aria-label="그래프 미리보기">
      <div className="chart-canvas-wrap">
        {selectedCount > 0 ? (
          <Suspense fallback={<div className="chart-empty">차트를 준비하는 중입니다.</div>}>
            <LazyChartView option={buildResult.option} />
          </Suspense>
        ) : (
          <div className="chart-empty" role="img" aria-label="empty chart">
            <strong>선택된 curve 없음</strong>
            <p>좌측 목록에서 분석할 데이터를 선택하세요.</p>
          </div>
        )}
      </div>
      {hasVisibleCurveWarning(selectedCount) && (
        <div className="chart-warning" role="status">
          <span>20개를 초과해 표시 중입니다. 구분이 어려울 수 있습니다.</span>
          <button type="button" onClick={() => setSelectionFilter("selected")}>
            선택 목록 보기
          </button>
        </div>
      )}
      {buildResult.scaleIssues.length > 0 && (
        <div className="chart-warning" role="status">
          {buildResult.scaleIssues.map((issue) => issue.message).join(" ")}
        </div>
      )}
      <div className="chart-status">
        {dataset ? `${selectedCount}개 curve 선택됨` : "데이터 업로드 후 선택한 curve가 여기에 표시됩니다."}
      </div>
    </section>
  );
}
