import { useId } from "react";
import { useAppStore } from "../app/appStore";

export function DataImportPanel() {
  const inputId = useId();
  const appendInputId = useId();
  const dataset = useAppStore((state) => state.dataset);
  const importStatus = useAppStore((state) => state.importStatus);
  const importError = useAppStore((state) => state.importError);
  const importFile = useAppStore((state) => state.importFile);
  const appendFile = useAppStore((state) => state.appendFile);
  const busy = importStatus === "importing";

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
          if (file) void importFile(file);
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
    </section>
  );
}
