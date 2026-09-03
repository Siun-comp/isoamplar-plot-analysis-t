import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { SelectionFilter } from "../data/types";
import { useAppStore } from "../app/appStore";
import type { GroupingMode } from "../data/types";
import { curveLabelSeparator } from "../data/curveLabels";
import { buildSelectionTree } from "../selection/buildTrees";
import { getFilteredCurveIds, getMatchedCurveIds } from "../selection/searchCurves";
import { IndeterminateCheckbox } from "./IndeterminateCheckbox";
import { SegmentedControl } from "./SegmentedControl";
import { SelectionSetPanel } from "./SelectionSetPanel";
import { DataExclusionDialog } from "./DataExclusionDialog";
import { useWarningNavigation } from "./WarningNavigationContext";

const groupingOptions: Array<{ value: GroupingMode; label: string }> = [
  { value: "reagent", label: "시약별" },
  { value: "specimen", label: "검체별" }
];

const filterOptions: Array<{ value: SelectionFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "selected", label: "선택됨" },
  { value: "unselected", label: "미선택" },
  { value: "warning", label: "경고" }
];

export function DataSelectionPanel() {
  const dataset = useAppStore((state) => state.dataset);
  const activeAnalysisId = useAppStore((state) => state.activeAnalysisId);
  const selection = useAppStore((state) => state.selection);
  const searchQuery = useAppStore((state) => state.searchQuery);
  const selectionFilter = useAppStore((state) => state.selectionFilter);
  const setSearchQuery = useAppStore((state) => state.setSearchQuery);
  const setSelectionFilter = useAppStore((state) => state.setSelectionFilter);
  const setGroupingMode = useAppStore((state) => state.setGroupingMode);
  const setCurvesSelected = useAppStore((state) => state.setCurvesSelected);
  const toggleCurve = useAppStore((state) => state.toggleCurve);
  const toggleGroup = useAppStore((state) => state.toggleGroup);
  const setAllGroupsCollapsed = useAppStore((state) => state.setAllGroupsCollapsed);
  const excludeCurves = useAppStore((state) => state.excludeCurves);
  const restoreExcludedCurves = useAppStore((state) => state.restoreExcludedCurves);
  const [exclusionRequest, setExclusionRequest] = useState<
    { mode: "exclude"; curveIds: string[]; label: string } | { mode: "restore" } | null
  >(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const treeScrollRef = useRef<HTMLDivElement>(null);
  const { target: warningTarget, clearWarningReveal } = useWarningNavigation();
  const warningRevealActive = Boolean(warningTarget && warningTarget.analysisId === activeAnalysisId && dataset);
  const revealedCurveIds = useMemo(
    () =>
      warningRevealActive
        ? new Set(warningTarget?.curveIds.filter(
            (curveId) => dataset?.curves.some((curve) => curve.curveId === curveId) && !selection?.excludedCurveIds.has(curveId)
          ) ?? [])
        : new Set<string>(),
    [dataset, selection, warningRevealActive, warningTarget]
  );

  const activeCurveIds = useMemo(() => {
    if (!dataset || !selection) return new Set<string>();
    return new Set(dataset.orderedCurveIds.filter((curveId) => !selection.excludedCurveIds.has(curveId)));
  }, [dataset, selection]);

  const filteredCurveIds = useMemo(() => {
    if (!dataset || !selection) return new Set<string>();
    if (warningRevealActive) return revealedCurveIds;
    const filtered = getFilteredCurveIds(
      dataset,
      getMatchedCurveIds(dataset, deferredSearchQuery),
      selection.selectedCurveIds,
      selectionFilter
    );
    return new Set([...filtered].filter((curveId) => activeCurveIds.has(curveId)));
  }, [activeCurveIds, dataset, deferredSearchQuery, revealedCurveIds, selection, selectionFilter, warningRevealActive]);

  const tree = useMemo(() => {
    if (!dataset || !selection) return [];
    return buildSelectionTree({
      dataset,
      groupingMode: selection.groupingMode,
      selectedCurveIds: selection.selectedCurveIds,
      collapsedGroupIds: warningRevealActive ? new Set() : selection.collapsedGroupIds,
      includedCurveIds: filteredCurveIds
    });
  }, [dataset, filteredCurveIds, selection, warningRevealActive]);
  const rowVirtualizer = useVirtualizer({
    count: tree.length,
    getScrollElement: () => treeScrollRef.current,
    estimateSize: (index) => estimateGroupHeight(tree[index]),
    initialRect: { width: 320, height: 500 },
    overscan: 6
  });
  const useVirtualTree = import.meta.env.MODE !== "test";

  useEffect(() => {
    if (warningTarget && warningTarget.analysisId !== activeAnalysisId) clearWarningReveal();
  }, [activeAnalysisId, clearWarningReveal, warningTarget]);

  useEffect(() => {
    if (!warningRevealActive || tree.length === 0) return;
    rowVirtualizer.scrollToIndex(0, { align: "start" });
    const frame = window.requestAnimationFrame(() => {
      treeScrollRef.current?.querySelector<HTMLElement>("[data-warning-focus='true']")?.scrollIntoView?.({ block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [rowVirtualizer, tree.length, warningRevealActive, warningTarget?.requestId]);

  if (!dataset || !selection) {
    return (
      <div className="empty-state">
        <strong>분석 데이터를 가져오세요</strong>
        <p>Excel 또는 붙여넣기 입력 후 시약별 기본 보기에서 모든 대분류가 접힌 상태로 시작합니다.</p>
      </div>
    );
  }

  const selectedCount = selection.selectedCurveIds.size;
  const requestExclusion = (curveIds: string[], label: string) => {
    const activeIds = curveIds.filter((curveId) => activeCurveIds.has(curveId));
    if (activeIds.length > 0) setExclusionRequest({ mode: "exclude", curveIds: activeIds, label });
  };

  return (
    <div className="selection-workspace">
      <SegmentedControl
        label="데이터 선택 보기"
        value={selection.groupingMode}
        options={groupingOptions}
        onChange={setGroupingMode}
      />

      {warningRevealActive && (
        <div className="warning-reveal-banner" role="status">
          <span>{warningTarget?.warningLabel} 관련 데이터 {revealedCurveIds.size}개를 임시 표시 중</span>
          <button type="button" onClick={clearWarningReveal}>원래 보기</button>
        </div>
      )}

      <label className="field-label" htmlFor="curve-search">
        검색
      </label>
      <input
        id="curve-search"
        className="text-input"
        type="search"
        value={searchQuery}
        placeholder="검체, 시약, curve label"
        onChange={(event) => setSearchQuery(event.currentTarget.value)}
      />

      <SegmentedControl
        label="표시 필터"
        value={selectionFilter}
        options={filterOptions}
        onChange={setSelectionFilter}
      />

      <div className="selection-meta">
        <span>표시 {filteredCurveIds.size}</span>
        <span>선택 {selectedCount}</span>
      </div>

      <SelectionSetPanel key={activeAnalysisId} />

      <div className="selection-actions">
        <button type="button" onClick={() => setCurvesSelected(filteredCurveIds, true)} disabled={filteredCurveIds.size === 0}>
          표시 선택
        </button>
        <button type="button" onClick={() => setCurvesSelected(filteredCurveIds, false)} disabled={filteredCurveIds.size === 0}>
          표시 해제
        </button>
        <button type="button" onClick={() => setAllGroupsCollapsed(true)}>
          모두 접기
        </button>
        <button type="button" onClick={() => setAllGroupsCollapsed(false)}>
          모두 펼치기
        </button>
        <button
          type="button"
          className="excluded-manager-button"
          disabled={selection.excludedCurveIds.size === 0}
          onClick={() => setExclusionRequest({ mode: "restore" })}
        >
          제외 항목 {selection.excludedCurveIds.size}
        </button>
      </div>

      <div ref={treeScrollRef} className="selection-tree" role="tree" aria-label="PCR curve selection tree">
        {tree.length === 0 && <p className="muted">표시 조건에 맞는 데이터가 없습니다.</p>}
        {tree.length > 0 && !useVirtualTree && (
          <div className="plain-tree-list">
            {tree.map((group) => (
              <section className="tree-group" key={group.groupId}>
                <div className="tree-row group-row">
                  <IndeterminateCheckbox
                    checkState={group.checkState}
                    label={`${group.label} 선택`}
                    onChange={(checked) => setCurvesSelected(group.curveIds, checked)}
                  />
                  <button
                    type="button"
                    className="tree-toggle"
                    aria-expanded={!group.collapsed}
                    onClick={() => toggleGroup(group.groupId)}
                  >
                    {group.collapsed ? "▸" : "▾"} {group.label}
                  </button>
                  <span className="count-badge">{group.selectedCount}/{group.totalCount}</span>
                  <button
                    type="button"
                    className="tree-exclude-button"
                    title={`${group.label} 그룹을 분석에서 제외`}
                    aria-label="그룹을 분석에서 제외"
                    onClick={() => requestExclusion(group.curveIds, `${group.label} 그룹`)}
                  >−</button>
                </div>
                {!group.collapsed &&
                  group.subgroups.map((subgroup) =>
                    renderSubgroupRows({ subgroup, setCurvesSelected, toggleCurve, revealedCurveIds, requestExclusion })
                  )}
              </section>
            ))}
          </div>
        )}
        {tree.length > 0 && useVirtualTree && (
          <div className="virtual-tree-spacer" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const group = tree[virtualRow.index];
              return (
                <section
                  className="tree-group virtual-tree-item"
                  data-index={virtualRow.index}
                  key={group.groupId}
                  ref={rowVirtualizer.measureElement}
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <div className="tree-row group-row">
                    <IndeterminateCheckbox
                      checkState={group.checkState}
                      label={`${group.label} 선택`}
                      onChange={(checked) => setCurvesSelected(group.curveIds, checked)}
                    />
                    <button
                      type="button"
                      className="tree-toggle"
                      aria-expanded={!group.collapsed}
                      onClick={() => toggleGroup(group.groupId)}
                    >
                      {group.collapsed ? "▸" : "▾"} {group.label}
                    </button>
                    <span className="count-badge">{group.selectedCount}/{group.totalCount}</span>
                    <button
                      type="button"
                      className="tree-exclude-button"
                      title={`${group.label} 그룹을 분석에서 제외`}
                      aria-label="그룹을 분석에서 제외"
                      onClick={() => requestExclusion(group.curveIds, `${group.label} 그룹`)}
                    >−</button>
                  </div>
                  {!group.collapsed &&
                    group.subgroups.map((subgroup) =>
                      renderSubgroupRows({ subgroup, setCurvesSelected, toggleCurve, revealedCurveIds, requestExclusion })
                    )}
                </section>
              );
            })}
          </div>
        )}
      </div>
      {exclusionRequest && (
        <DataExclusionDialog
          key={exclusionRequest.mode === "exclude" ? exclusionRequest.curveIds.join("|") : "restore"}
          dataset={dataset}
          mode={exclusionRequest.mode}
          candidateCurveIds={
            exclusionRequest.mode === "exclude"
              ? exclusionRequest.curveIds
              : [...selection.excludedCurveIds]
          }
          targetLabel={exclusionRequest.mode === "exclude" ? exclusionRequest.label : undefined}
          onExclude={(curveIds) => {
            excludeCurves(curveIds);
            setExclusionRequest(null);
          }}
          onRestore={(curveIds) => {
            restoreExcludedCurves(curveIds);
            if ((useAppStore.getState().selection?.excludedCurveIds.size ?? 0) === 0) setExclusionRequest(null);
          }}
          onClose={() => setExclusionRequest(null)}
        />
      )}
    </div>
  );
}

type TreeSubgroup = ReturnType<typeof buildSelectionTree>[number]["subgroups"][number];

function renderSubgroupRows({
  subgroup,
  setCurvesSelected,
  toggleCurve,
  revealedCurveIds,
  requestExclusion
}: {
  subgroup: TreeSubgroup;
  setCurvesSelected: (curveIds: Iterable<string>, selected: boolean) => void;
  toggleCurve: (curveId: string) => void;
  revealedCurveIds: Set<string>;
  requestExclusion: (curveIds: string[], label: string) => void;
}) {
  if (subgroup.curves.length === 1) {
    const curve = subgroup.curves[0];
    return (
      <div
        className={`tree-row single-curve-row ${revealedCurveIds.has(curve.curveId) ? "is-warning-focus" : ""}`}
        data-curve-id={curve.curveId}
        data-warning-focus={revealedCurveIds.has(curve.curveId)}
        key={subgroup.groupId}
      >
        <label className="tree-curve-label">
          <input
            type="checkbox"
            aria-label={`${curve.label} 선택 · ${curve.sourceLabel}`}
            checked={curve.selected}
            onChange={() => toggleCurve(curve.curveId)}
          />
          <span>{createSingleCurveRowLabel(subgroup.label, curve.label)}</span>
        </label>
        {curve.warningCount > 0 && <span className="warning-dot" aria-label="warning">!</span>}
        <button
          type="button"
          className="tree-exclude-button"
          title="이 곡선을 분석에서 제외"
          aria-label="곡선을 분석에서 제외"
          onClick={() => requestExclusion([curve.curveId], curve.label)}
        >−</button>
      </div>
    );
  }

  return (
    <div className="tree-subgroup" key={subgroup.groupId}>
      <div className="tree-row subgroup-row">
        <IndeterminateCheckbox
          checkState={subgroup.checkState}
          label={`${subgroup.label} 선택`}
          onChange={(checked) => setCurvesSelected(subgroup.curveIds, checked)}
        />
        <span>{subgroup.label}</span>
        <span className="count-badge">{subgroup.selectedCount}/{subgroup.totalCount}</span>
        <button
          type="button"
          className="tree-exclude-button"
          title={`${subgroup.label} 그룹을 분석에서 제외`}
          aria-label="그룹을 분석에서 제외"
          onClick={() => requestExclusion(subgroup.curveIds, `${subgroup.label} 그룹`)}
        >−</button>
      </div>
      {subgroup.curves.map((curve) => (
        <div
          className={`tree-row curve-row ${revealedCurveIds.has(curve.curveId) ? "is-warning-focus" : ""}`}
          data-curve-id={curve.curveId}
          data-warning-focus={revealedCurveIds.has(curve.curveId)}
          key={curve.curveId}
        >
          <label className="tree-curve-label">
            <input
              type="checkbox"
              aria-label={`${curve.label} 선택 · ${curve.sourceLabel}`}
              checked={curve.selected}
              onChange={() => toggleCurve(curve.curveId)}
            />
            <span>{curve.label}</span>
          </label>
          {curve.warningCount > 0 && <span className="warning-dot" aria-label="warning">!</span>}
          <button
            type="button"
            className="tree-exclude-button"
            title="이 곡선을 분석에서 제외"
            aria-label="곡선을 분석에서 제외"
            onClick={() => requestExclusion([curve.curveId], curve.label)}
          >−</button>
        </div>
      ))}
    </div>
  );
}

function createSingleCurveRowLabel(subgroupLabel: string, curveLabel: string) {
  return curveLabel.includes(subgroupLabel) ? curveLabel : `${subgroupLabel}${curveLabelSeparator}${curveLabel}`;
}

function estimateGroupHeight(group: ReturnType<typeof buildSelectionTree>[number]) {
  if (!group || group.collapsed) return 48;
  const visibleRows = group.subgroups.reduce((count, subgroup) => {
    if (subgroup.curves.length === 1) return count + 1;
    return count + 1 + subgroup.curves.length;
  }, 0);
  return 48 + visibleRows * 34;
}
