import { useDeferredValue, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { SelectionFilter } from "../app/appStore";
import { useAppStore } from "../app/appStore";
import type { GroupingMode, PcrDataset } from "../data/types";
import { buildSelectionTree } from "../selection/buildTrees";
import { getMatchedCurveIds } from "../selection/searchCurves";
import { IndeterminateCheckbox } from "./IndeterminateCheckbox";
import { SegmentedControl } from "./SegmentedControl";

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
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const treeScrollRef = useRef<HTMLDivElement>(null);

  const filteredCurveIds = useMemo(() => {
    if (!dataset || !selection) return new Set<string>();
    return getFilteredCurveIds(dataset, getMatchedCurveIds(dataset, deferredSearchQuery), selection.selectedCurveIds, selectionFilter);
  }, [dataset, deferredSearchQuery, selection, selectionFilter]);

  const tree = useMemo(() => {
    if (!dataset || !selection) return [];
    return buildSelectionTree({
      dataset,
      groupingMode: selection.groupingMode,
      selectedCurveIds: selection.selectedCurveIds,
      collapsedGroupIds: selection.collapsedGroupIds,
      includedCurveIds: filteredCurveIds
    });
  }, [dataset, filteredCurveIds, selection]);
  const rowVirtualizer = useVirtualizer({
    count: tree.length,
    getScrollElement: () => treeScrollRef.current,
    estimateSize: (index) => estimateGroupHeight(tree[index]),
    initialRect: { width: 320, height: 500 },
    overscan: 6
  });
  const useVirtualTree = import.meta.env.MODE !== "test";

  if (!dataset || !selection) {
    return (
      <div className="empty-state">
        <strong>Excel 파일을 업로드하세요</strong>
        <p>업로드 후 시약별 기본 보기에서 모든 대분류가 접힌 상태로 시작합니다.</p>
      </div>
    );
  }

  const selectedCount = selection.selectedCurveIds.size;

  return (
    <div className="selection-workspace">
      <SegmentedControl
        label="데이터 선택 보기"
        value={selection.groupingMode}
        options={groupingOptions}
        onChange={setGroupingMode}
      />

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
                </div>
                {!group.collapsed &&
                  group.subgroups.map((subgroup) => (
                    <div className="tree-subgroup" key={subgroup.groupId}>
                      <div className="tree-row subgroup-row">
                        <IndeterminateCheckbox
                          checkState={subgroup.checkState}
                          label={`${subgroup.label} 선택`}
                          onChange={(checked) => setCurvesSelected(subgroup.curveIds, checked)}
                        />
                        <span>{subgroup.label}</span>
                        <span className="count-badge">{subgroup.selectedCount}/{subgroup.totalCount}</span>
                      </div>
                      {subgroup.curves.map((curve) => (
                        <label className="tree-row curve-row" key={curve.curveId}>
                          <input
                            type="checkbox"
                            checked={curve.selected}
                            onChange={() => toggleCurve(curve.curveId)}
                          />
                          <span>{curve.label}</span>
                          {curve.warningCount > 0 && <span className="warning-dot" aria-label="warning">!</span>}
                        </label>
                      ))}
                    </div>
                  ))}
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
                  </div>
                  {!group.collapsed &&
                    group.subgroups.map((subgroup) => (
                      <div className="tree-subgroup" key={subgroup.groupId}>
                        <div className="tree-row subgroup-row">
                          <IndeterminateCheckbox
                            checkState={subgroup.checkState}
                            label={`${subgroup.label} 선택`}
                            onChange={(checked) => setCurvesSelected(subgroup.curveIds, checked)}
                          />
                          <span>{subgroup.label}</span>
                          <span className="count-badge">{subgroup.selectedCount}/{subgroup.totalCount}</span>
                        </div>
                        {subgroup.curves.map((curve) => (
                          <label className="tree-row curve-row" key={curve.curveId}>
                            <input
                              type="checkbox"
                              checked={curve.selected}
                              onChange={() => toggleCurve(curve.curveId)}
                            />
                            <span>{curve.label}</span>
                            {curve.warningCount > 0 && <span className="warning-dot" aria-label="warning">!</span>}
                          </label>
                        ))}
                      </div>
                    ))}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function getFilteredCurveIds(
  dataset: PcrDataset,
  matchedCurveIds: Set<string>,
  selectedCurveIds: Set<string>,
  filter: SelectionFilter
) {
  return new Set(
    dataset.curves
      .filter((curve) => matchedCurveIds.has(curve.curveId))
      .filter((curve) => {
        if (filter === "selected") return selectedCurveIds.has(curve.curveId);
        if (filter === "unselected") return !selectedCurveIds.has(curve.curveId);
        if (filter === "warning") return curve.warnings.length > 0;
        return true;
      })
      .map((curve) => curve.curveId)
  );
}

function estimateGroupHeight(group: ReturnType<typeof buildSelectionTree>[number]) {
  if (!group || group.collapsed) return 48;
  const curveRows = group.subgroups.reduce((count, subgroup) => count + subgroup.curves.length, 0);
  return 48 + group.subgroups.length * 36 + curveRows * 34;
}
