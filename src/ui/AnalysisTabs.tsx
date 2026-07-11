import { useState, type KeyboardEvent } from "react";
import { useAppStore } from "../app/appStore";
import { createAnalysisState } from "../analysis/analysisState";
import { createAnalysisWorkbookFileName, exportAnalysisWorkbookBlob } from "../analysis/analysisWorkbook";
import { downloadBlob } from "../chart/exportChart";

export function AnalysisTabs() {
  const confirmationTitleId = "analysis-close-confirmation-title";
  const activeAnalysisId = useAppStore((state) => state.activeAnalysisId);
  const analysisOrder = useAppStore((state) => state.analysisOrder);
  const analyses = useAppStore((state) => state.analyses);
  const analysisName = useAppStore((state) => state.analysisName);
  const dirty = useAppStore((state) => state.dirty);
  const dataset = useAppStore((state) => state.dataset);
  const selection = useAppStore((state) => state.selection);
  const createAnalysis = useAppStore((state) => state.createAnalysis);
  const switchAnalysis = useAppStore((state) => state.switchAnalysis);
  const renameAnalysis = useAppStore((state) => state.renameAnalysis);
  const closeAnalysis = useAppStore((state) => state.closeAnalysis);
  const markAnalysisSaveSuccess = useAppStore((state) => state.markAnalysisSaveSuccess);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);
  const [savingClose, setSavingClose] = useState(false);

  function handleCreateAnalysis() {
    const nextId = createAnalysis();
    switchAnalysis(nextId);
    setMessage(null);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (currentIndex + direction + analysisOrder.length) % analysisOrder.length;
    const nextId = analysisOrder[nextIndex];
    switchAnalysis(nextId);
    document.getElementById(createTabId(nextId))?.focus();
  }

  function handleCloseAnalysis(analysisId: string) {
    const didClose = closeAnalysis(analysisId);
    setMessage(null);
    setPendingCloseId(didClose ? null : analysisId);
  }

  function cancelPendingClose() {
    setPendingCloseId(null);
    setMessage(null);
  }

  function discardAndClosePendingAnalysis() {
    if (!pendingCloseId) return;
    const didClose = closeAnalysis(pendingCloseId, { force: true });
    setPendingCloseId(didClose ? null : pendingCloseId);
    setMessage(didClose ? null : "Analysis could not be closed.");
  }

  async function saveAndClosePendingAnalysis() {
    if (!pendingCloseId) return;
    const state = useAppStore.getState();
    if (state.activeAnalysisId !== pendingCloseId || !state.dataset || !state.selection) {
      setMessage("Only the active analysis with imported data can be saved before closing.");
      return;
    }

    setSavingClose(true);
    setMessage(null);
    try {
      const nextExportCounter = state.exportCounter + 1;
      const analysisState = createAnalysisState({
        analysisId: state.activeAnalysisId,
        analysisName: state.analysisName,
        dataset: state.dataset,
        selection: state.selection,
        searchQuery: state.searchQuery,
        selectionFilter: state.selectionFilter,
        chartScale: state.chartScale,
        styleRules: state.styleRules,
        curveOverrides: state.curveOverrides,
        legendSettings: state.legendSettings,
        exportSettings: state.exportSettings,
        exportCounter: nextExportCounter,
        importFileName: state.importFileName,
        sourceFiles: state.sourceFiles,
        dirty: state.dirty
      });
      const blob = await exportAnalysisWorkbookBlob(analysisState);
      const fileName = createAnalysisWorkbookFileName(state.exportCounter, new Date(), state.analysisName);
      downloadBlob(blob, fileName);
      const saveResult = markAnalysisSaveSuccess({
        analysisId: state.activeAnalysisId,
        runtimeInstanceId: state.runtimeInstanceId,
        expectedRevision: state.revision,
        savedExportCounter: nextExportCounter,
        message: `Saved ${fileName}.`
      });
      if (saveResult !== "saved") {
        setMessage(
          saveResult === "changed"
            ? "Analysis changed while the file was being saved. The current analysis remains open and Unsaved."
            : "The original analysis tab is no longer available."
        );
        return;
      }
      const didClose = useAppStore.getState().closeAnalysis(pendingCloseId, { force: true });
      setPendingCloseId(didClose ? null : pendingCloseId);
      setMessage(didClose ? null : "Analysis could not be closed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Analysis XLSX export failed.");
    } finally {
      setSavingClose(false);
    }
  }

  return (
    <section className="analysis-tabs" aria-label="Analysis tabs">
      <div className="analysis-tab-toolbar">
        <div className="analysis-tab-strip" role="tablist" aria-label="Open analyses">
          {analysisOrder.map((analysisId, index) => {
            const analysis = analyses[analysisId];
            const isActive = analysisId === activeAnalysisId;
            const title = analysis?.analysisName?.trim() || "Untitled analysis";
            return (
              <button
                key={analysisId}
                id={createTabId(analysisId)}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls="analysis-workspace"
                tabIndex={isActive ? 0 : -1}
                className={`analysis-tab-button ${isActive ? "is-active" : ""}`}
                title={analysis?.dirty ? `${title} - unsaved changes` : title}
                onClick={() => {
                  switchAnalysis(analysisId);
                  setMessage(null);
                }}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                <span>{title}</span>
                {analysis?.dirty && <span className="dirty-dot" aria-label="unsaved changes" title="Unsaved changes" />}
              </button>
            );
          })}
        </div>
        <button type="button" className="analysis-new-button" onClick={handleCreateAnalysis}>
          New analysis
        </button>
      </div>

      <div className="analysis-name-row">
        <label htmlFor="analysis-name">Analysis name</label>
        <input
          id="analysis-name"
          type="text"
          value={analysisName}
          onChange={(event) => {
            renameAnalysis(activeAnalysisId, event.currentTarget.value);
            setMessage(null);
          }}
          onBlur={(event) => {
            if (event.currentTarget.value.trim() === "") {
              renameAnalysis(activeAnalysisId, "Untitled analysis");
            }
          }}
        />
        <span className={dirty ? "dirty-status is-dirty" : "dirty-status"}>{dirty ? "Unsaved" : "Clean"}</span>
        <button
          type="button"
          className="analysis-active-close"
          aria-label={`Close ${analysisName.trim() || "Untitled analysis"}`}
          onClick={() => handleCloseAnalysis(activeAnalysisId)}
        >
          Close
        </button>
      </div>
      {message && (
        <p className="analysis-tab-message" role="status">
          {message}
        </p>
      )}
      {pendingCloseId && (
        <div className="confirmation-panel" role="alertdialog" aria-modal="true" aria-labelledby={confirmationTitleId}>
          <h3 id={confirmationTitleId}>Unsaved analysis</h3>
          <p>현재 분석에 저장되지 않은 변경사항이 있습니다. 닫기 전에 Analysis XLSX로 저장하거나 저장하지 않고 닫을 수 있습니다.</p>
          <div className="confirmation-actions">
            <button type="button" aria-label="Cancel close" disabled={savingClose} onClick={cancelPendingClose}>
              Cancel
            </button>
            <button
              type="button"
              aria-label="Save Analysis XLSX then close"
              disabled={savingClose || !dataset || !selection}
              onClick={() => void saveAndClosePendingAnalysis()}
            >
              Analysis XLSX 저장 후 닫기
            </button>
            <button type="button" aria-label="Close without saving" disabled={savingClose} onClick={discardAndClosePendingAnalysis}>
              저장하지 않고 닫기
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function createTabId(analysisId: string) {
  return `analysis-tab-${analysisId}`;
}
