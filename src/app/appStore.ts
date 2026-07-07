import { enableMapSet } from "immer";
import { immer } from "zustand/middleware/immer";
import { create } from "zustand";
import type { AxisId, ChartScaleState, ScaleMode, ScalePresetId } from "../chart/chartScale";
import { createDefaultChartScale } from "../chart/chartScale";
import type { BuiltInStylePresetId } from "../chart/chartStyle";
import { createDefaultStyleRules, createPresetOverrides } from "../chart/chartStyle";
import type { CurveStyleOverride, GroupingMode, LineType, PcrDataset, SelectionState, StyleGroupingTarget, StyleRules } from "../data/types";
import { parseExcelFile } from "../data/parseExcel";
import { appendPcrDataset } from "../data/mergeDatasets";
import { createAllMajorGroupIds } from "../selection/buildTrees";
import {
  createInitialSelectionState,
  setAllGroupsCollapsed,
  setCurveSelection,
  setGroupingMode as setSelectionGroupingMode,
  toggleCurveSelection,
  toggleGroupCollapse
} from "../selection/selectionState";

enableMapSet();

export type SelectionFilter = "all" | "selected" | "unselected" | "warning";

type ImportStatus = "idle" | "importing" | "ready" | "error";

type PresetUndoSnapshot = {
  previousOverrides: Record<string, CurveStyleOverride | undefined>;
  affectedCurveIds: string[];
};

type AppStore = {
  dataset: PcrDataset | null;
  selection: SelectionState | null;
  searchQuery: string;
  selectionFilter: SelectionFilter;
  chartScale: ChartScaleState;
  styleRules: StyleRules;
  curveOverrides: Record<string, CurveStyleOverride>;
  lastPresetUndo: PresetUndoSnapshot | null;
  lastPresetMessage: string | null;
  exportCounter: number;
  exportMessage: string | null;
  importStatus: ImportStatus;
  importError: string | null;
  importFileName: string | null;
  loadDataset: (dataset: PcrDataset) => void;
  importFile: (file: File) => Promise<void>;
  appendFile: (file: File) => Promise<void>;
  reset: () => void;
  setSearchQuery: (query: string) => void;
  setSelectionFilter: (filter: SelectionFilter) => void;
  setAxisScaleMode: (axis: AxisId, mode: ScaleMode) => void;
  setAxisFixedValue: (axis: AxisId, bound: "min" | "max", value: string) => void;
  setAxisPresetValue: (axis: AxisId, preset: ScalePresetId, field: "label" | "min" | "max", value: string) => void;
  setStyleGroupingTarget: (field: "colorBy" | "lineTypeBy", target: StyleGroupingTarget) => void;
  setGroupColor: (target: StyleGroupingTarget, entityId: string, color: string) => void;
  setGroupLineType: (target: StyleGroupingTarget, entityId: string, lineType: LineType) => void;
  setCurveOverride: (curveId: string, override: CurveStyleOverride) => void;
  applyStylePreset: (preset: BuiltInStylePresetId, curveIds: Iterable<string>) => void;
  undoLastPreset: () => void;
  moveCurveOrder: (curveId: string, direction: "up" | "down") => void;
  markExportSuccess: (message: string) => void;
  setExportMessage: (message: string | null) => void;
  setGroupingMode: (groupingMode: GroupingMode) => void;
  toggleCurve: (curveId: string) => void;
  setCurvesSelected: (curveIds: Iterable<string>, selected: boolean) => void;
  toggleGroup: (groupId: string) => void;
  setAllGroupsCollapsed: (collapsed: boolean) => void;
};

const initialState = {
  dataset: null,
  selection: null,
  searchQuery: "",
  selectionFilter: "all" as SelectionFilter,
  chartScale: createDefaultChartScale(),
  styleRules: createDefaultStyleRules(),
  curveOverrides: {},
  lastPresetUndo: null,
  lastPresetMessage: null,
  exportCounter: 1,
  exportMessage: null,
  importStatus: "idle" as ImportStatus,
  importError: null,
  importFileName: null
};

export const useAppStore = create<AppStore>()(
  immer((set, get) => ({
    ...initialState,
    loadDataset: (dataset) => {
      set((state) => {
        state.dataset = dataset;
        state.selection = createInitialSelectionState(dataset);
        state.searchQuery = "";
        state.selectionFilter = "all";
        state.chartScale = createDefaultChartScale();
        state.styleRules = createDefaultStyleRules();
        state.curveOverrides = {};
        state.lastPresetUndo = null;
        state.lastPresetMessage = null;
        state.exportCounter = 1;
        state.exportMessage = null;
        state.importStatus = "ready";
        state.importError = null;
        state.importFileName = dataset.sourceFileName;
      });
    },
    importFile: async (file) => {
      set((state) => {
        state.importStatus = "importing";
        state.importError = null;
        state.importFileName = file.name;
      });

      const result = await parseExcelFile(file);
      if (result.ok) {
        get().loadDataset(result.dataset);
      } else {
        set((state) => {
          state.dataset = null;
          state.selection = null;
          state.importStatus = "error";
          state.importError = result.error.message;
        });
      }
    },
    appendFile: async (file) => {
      const currentDataset = get().dataset;
      if (!currentDataset) {
        await get().importFile(file);
        return;
      }

      set((state) => {
        state.importStatus = "importing";
        state.importError = null;
        state.importFileName = file.name;
      });

      const result = await parseExcelFile(file);
      if (result.ok) {
        set((state) => {
          if (!state.dataset) {
            state.dataset = result.dataset;
            state.selection = createInitialSelectionState(result.dataset);
            state.importStatus = "ready";
            state.importFileName = result.dataset.sourceFileName;
            return;
          }

          const previousDataset = state.dataset;
          const previousSelection = state.selection;
          const mergeResult = appendPcrDataset(previousDataset, result.dataset);
          const mergedCurveIds = new Set(mergeResult.dataset.curves.map((curve) => curve.curveId));
          const previousMajorGroupIds = createAllMajorGroupIds(previousDataset);
          const nextMajorGroupIds = createAllMajorGroupIds(mergeResult.dataset);
          const collapsedGroupIds = new Set(previousSelection?.collapsedGroupIds ?? []);

          nextMajorGroupIds.forEach((groupId) => {
            if (!previousMajorGroupIds.has(groupId)) {
              collapsedGroupIds.add(groupId);
            }
          });

          state.dataset = mergeResult.dataset;
          state.selection = {
            groupingMode: previousSelection?.groupingMode ?? "reagent",
            selectedCurveIds: new Set(
              [...(previousSelection?.selectedCurveIds ?? new Set<string>())].filter((curveId) => mergedCurveIds.has(curveId))
            ),
            collapsedGroupIds,
            orderedCurveIds: [
              ...(previousSelection?.orderedCurveIds ?? previousDataset.orderedCurveIds).filter((curveId) => mergedCurveIds.has(curveId)),
              ...mergeResult.appendedCurveIds
            ]
          };
          state.importStatus = "ready";
          state.importError = null;
          state.importFileName = `${file.name} appended`;
        });
      } else {
        set((state) => {
          state.importStatus = state.dataset ? "ready" : "error";
          state.importError = result.error.message;
        });
      }
    },
    reset: () => {
      set(() => ({ ...initialState }));
    },
    setSearchQuery: (query) => {
      set((state) => {
        state.searchQuery = query;
      });
    },
    setSelectionFilter: (filter) => {
      set((state) => {
        state.selectionFilter = filter;
      });
    },
    setAxisScaleMode: (axis, mode) => {
      set((state) => {
        state.chartScale[axis].mode = mode;
      });
    },
    setAxisFixedValue: (axis, bound, value) => {
      set((state) => {
        if (bound === "min") {
          state.chartScale[axis].fixedMin = value;
        } else {
          state.chartScale[axis].fixedMax = value;
        }
      });
    },
    setAxisPresetValue: (axis, preset, field, value) => {
      set((state) => {
        state.chartScale[axis][preset] ??= {
          label: preset === "preset1" ? "P1" : "P2",
          min: "",
          max: ""
        };
        state.chartScale[axis][preset][field] = value;
      });
    },
    setStyleGroupingTarget: (field, target) => {
      set((state) => {
        state.styleRules[field] = target;
      });
    },
    setGroupColor: (target, entityId, color) => {
      set((state) => {
        const key = target === "specimen" ? "specimenColors" : "reagentColors";
        state.styleRules[key][entityId] = color;
      });
    },
    setGroupLineType: (target, entityId, lineType) => {
      set((state) => {
        const key = target === "specimen" ? "specimenLineTypes" : "reagentLineTypes";
        state.styleRules[key][entityId] = lineType;
      });
    },
    setCurveOverride: (curveId, override) => {
      set((state) => {
        state.curveOverrides[curveId] = {
          ...state.curveOverrides[curveId],
          ...override
        };
        state.lastPresetUndo = null;
      });
    },
    applyStylePreset: (preset, curveIds) => {
      set((state) => {
        if (!state.dataset) return;
        const affectedCurveIds = [...curveIds];
        const curvesById = new Map(state.dataset.curves.map((curve) => [curve.curveId, curve]));
        const affectedCurves = affectedCurveIds
          .map((curveId) => curvesById.get(curveId))
          .filter((curve): curve is NonNullable<typeof curve> => Boolean(curve));
        const nextOverrides = createPresetOverrides({ curves: affectedCurves, referenceCurves: state.dataset.curves, preset });
        const previousOverrides = Object.fromEntries(
          affectedCurves.map((curve) => [curve.curveId, state.curveOverrides[curve.curveId]])
        );

        affectedCurves.forEach((curve) => {
          state.curveOverrides[curve.curveId] = {
            ...state.curveOverrides[curve.curveId],
            ...nextOverrides[curve.curveId]
          };
        });
        state.lastPresetUndo = {
          previousOverrides,
          affectedCurveIds: affectedCurves.map((curve) => curve.curveId)
        };
        state.lastPresetMessage = `${affectedCurves.length} curves updated by preset.`;
      });
    },
    undoLastPreset: () => {
      set((state) => {
        if (!state.lastPresetUndo) return;
        state.lastPresetUndo.affectedCurveIds.forEach((curveId) => {
          const previous = state.lastPresetUndo?.previousOverrides[curveId];
          if (previous) {
            state.curveOverrides[curveId] = previous;
          } else {
            delete state.curveOverrides[curveId];
          }
        });
        state.lastPresetUndo = null;
        state.lastPresetMessage = "Last preset application was undone.";
      });
    },
    moveCurveOrder: (curveId, direction) => {
      set((state) => {
        if (!state.selection) return;
        const index = state.selection.orderedCurveIds.indexOf(curveId);
        if (index < 0) return;
        const nextIndex = direction === "up" ? index - 1 : index + 1;
        if (nextIndex < 0 || nextIndex >= state.selection.orderedCurveIds.length) return;
        const nextOrder = [...state.selection.orderedCurveIds];
        [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]];
        state.selection.orderedCurveIds = nextOrder;
      });
    },
    markExportSuccess: (message) => {
      set((state) => {
        state.exportMessage = message;
        state.exportCounter += 1;
      });
    },
    setExportMessage: (message) => {
      set((state) => {
        state.exportMessage = message;
      });
    },
    setGroupingMode: (groupingMode) => {
      set((state) => {
        if (!state.selection) return;
        state.selection = setSelectionGroupingMode(state.selection, groupingMode);
      });
    },
    toggleCurve: (curveId) => {
      set((state) => {
        if (!state.selection) return;
        state.selection = toggleCurveSelection(state.selection, curveId);
      });
    },
    setCurvesSelected: (curveIds, selected) => {
      set((state) => {
        if (!state.selection) return;
        state.selection = setCurveSelection(state.selection, curveIds, selected);
      });
    },
    toggleGroup: (groupId) => {
      set((state) => {
        if (!state.selection) return;
        state.selection = toggleGroupCollapse(state.selection, groupId);
      });
    },
    setAllGroupsCollapsed: (collapsed) => {
      set((state) => {
        if (!state.dataset || !state.selection) return;
        state.selection = setAllGroupsCollapsed(state.dataset, state.selection, collapsed);
      });
    }
  }))
);
