import type { GroupingMode, PcrDataset, SelectionState } from "../data/types";
import { createAllMajorGroupIds } from "./buildTrees";

export function createInitialSelectionState(dataset: PcrDataset): SelectionState {
  return {
    groupingMode: "reagent",
    selectedCurveIds: new Set<string>(),
    collapsedGroupIds: createAllMajorGroupIds(dataset),
    orderedCurveIds: [...dataset.orderedCurveIds]
  };
}

export function setGroupingMode(state: SelectionState, groupingMode: GroupingMode): SelectionState {
  return {
    ...state,
    groupingMode
  };
}

export function toggleCurveSelection(state: SelectionState, curveId: string): SelectionState {
  const selectedCurveIds = new Set(state.selectedCurveIds);

  if (selectedCurveIds.has(curveId)) {
    selectedCurveIds.delete(curveId);
  } else {
    selectedCurveIds.add(curveId);
  }

  return {
    ...state,
    selectedCurveIds
  };
}

export function setCurveSelection(state: SelectionState, curveIds: Iterable<string>, selected: boolean): SelectionState {
  const selectedCurveIds = new Set(state.selectedCurveIds);

  for (const curveId of curveIds) {
    if (selected) {
      selectedCurveIds.add(curveId);
    } else {
      selectedCurveIds.delete(curveId);
    }
  }

  return {
    ...state,
    selectedCurveIds
  };
}

export function toggleGroupCollapse(state: SelectionState, groupId: string): SelectionState {
  const collapsedGroupIds = new Set(state.collapsedGroupIds);

  if (collapsedGroupIds.has(groupId)) {
    collapsedGroupIds.delete(groupId);
  } else {
    collapsedGroupIds.add(groupId);
  }

  return {
    ...state,
    collapsedGroupIds
  };
}

export function setAllGroupsCollapsed(dataset: PcrDataset, state: SelectionState, collapsed: boolean): SelectionState {
  return {
    ...state,
    collapsedGroupIds: collapsed ? createAllMajorGroupIds(dataset) : new Set<string>()
  };
}

