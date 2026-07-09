import { useEffect, useId, useState } from "react";
import { useAppStore } from "../app/appStore";

type PendingReplaceFile = {
  file: File;
  analysisId: string;
};

export function DataImportPanel() {
  const inputId = useId();
  const appendInputId = useId();
  const confirmationTitleId = useId();
  const activeAnalysisId = useAppStore((state) => state.activeAnalysisId);
  const dataset = useAppStore((state) => state.dataset);
  const dirty = useAppStore((state) => state.dirty);
  const importStatus = useAppStore((state) => state.importStatus);
  const importError = useAppStore((state) => state.importError);
  const importFile = useAppStore((state) => state.importFile);
  const importFileWithMode = useAppStore((state) => state.importFileWithMode);
  const appendFile = useAppStore((state) => state.appendFile);
  const [pendingReplaceFile, setPendingReplaceFile] = useState<PendingReplaceFile | null>(null);
  const busy = importStatus === "importing";

  useEffect(() => {
    setPendingReplaceFile((pending) => (pending && pending.analysisId !== activeAnalysisId ? null : pending));
  }, [activeAnalysisId]);

  function handlePrimaryFile(file: File) {
    if (dirty) {
      setPendingReplaceFile({ file, analysisId: activeAnalysisId });
      return;
    }
    void importFile(file);
  }

  function clearPendingReplace() {
    setPendingReplaceFile(null);
  }

  function importPendingReplace(mode: "replace" | "newTab") {
    if (!pendingReplaceFile) return;
    const { file, analysisId } = pendingReplaceFile;
    setPendingReplaceFile(null);
    void importFileWithMode(file, mode, analysisId);
  }

  return (
    <section className="import-panel" aria-labelledby="import-title">
      <div>
        <h2 id="import-title">Excel 데이터</h2>
        <p>.xls 또는 .xlsx 첫 번째 worksheet만 사용합니다.</p>
      </div>
      <div className="import-actions">
        <label className="file-button" htmlFor={inputId} aria-disabled={busy}>
          파일 선택
        </label>
        <label className={`file-button ${!dataset || busy ? "is-disabled" : ""}`} htmlFor={!dataset || busy ? undefined : appendInputId}>
          추가 선택
        </label>
      </div>
      <input
        id={inputId}
        className="file-input"
        type="file"
        accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) handlePrimaryFile(file);
          event.currentTarget.value = "";
        }}
      />
      <input
        id={appendInputId}
        className="file-input"
        type="file"
        disabled={!dataset || busy}
        accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) void appendFile(file);
          event.currentTarget.value = "";
        }}
      />

      <div className="import-summary" aria-live="polite">
        {importStatus === "idle" && <span>업로드 전</span>}
        {importStatus === "importing" && <span>읽는 중</span>}
        {importStatus === "error" && <span className="error-text">{importError}</span>}
        {dataset && (
          <span>
            {dataset.sourceFileName} · {dataset.curves.length} curves · warnings {dataset.warnings.length}
          </span>
        )}
        {dataset && importError && importStatus !== "error" && <span className="error-text">{importError}</span>}
      </div>
      {pendingReplaceFile && (
        <div className="confirmation-panel" role="alertdialog" aria-modal="true" aria-labelledby={confirmationTitleId}>
          <h3 id={confirmationTitleId}>Unsaved analysis</h3>
          <p>
            현재 분석에 저장되지 않은 변경사항이 있습니다. {pendingReplaceFile.file.name} 파일을 현재 탭에 대체하거나 새 분석
            탭으로 열 수 있습니다.
          </p>
          <div className="confirmation-actions">
            <button type="button" aria-label="Cancel file replace" onClick={clearPendingReplace}>
              Cancel
            </button>
            <button type="button" aria-label="Replace current analysis" onClick={() => importPendingReplace("replace")}>
              현재 분석 대체
            </button>
            <button type="button" aria-label="Open file as new analysis" onClick={() => importPendingReplace("newTab")}>
              새 분석으로 열기
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
