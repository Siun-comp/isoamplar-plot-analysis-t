import { useEffect, useId, useRef, useState } from "react";
import { APP_VERSION, getReleaseUrl, RELEASE_HISTORY } from "../releaseHistory";

export function VersionHistoryDialog() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      closeButtonRef.current?.focus();
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  function closeDialog() {
    const dialog = dialogRef.current;
    if (dialog?.open && typeof dialog.close === "function") dialog.close();
    else dialog?.removeAttribute("open");
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="version-button"
        aria-label={`버전 v${APP_VERSION} 및 변경 이력`}
        onClick={() => setOpen(true)}
      >
        v{APP_VERSION}
      </button>
      <dialog
        ref={dialogRef}
        className="version-history-dialog"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClose={() => setOpen(false)}
        onCancel={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
      >
        <div className="version-dialog-header">
          <div>
            <p className="eyebrow">IsoAmplar Plot Analysis T</p>
            <h2 id={titleId}>버전 및 변경 이력</h2>
            <p id={descriptionId}>현재 T판이 유일한 유지보수 판본이며, 검증된 이전 버전은 재현용으로 보존됩니다.</p>
          </div>
          <button ref={closeButtonRef} type="button" className="icon-button" aria-label="버전 이력 닫기" onClick={closeDialog}>
            ×
          </button>
        </div>
        <div className="version-release-list">
          {RELEASE_HISTORY.map((release) => (
            <section className="version-release" key={release.version} aria-label={`v${release.version}`}>
              <div className="version-release-heading">
                <div>
                  <strong>v{release.version}</strong>
                  <span>{release.releasedOn} · Analysis XLSX schema {release.analysisSchemaVersion}</span>
                </div>
                {release.current ? (
                  <span className="current-version-label">현재 버전</span>
                ) : (
                  <a className="version-open-link" href={getReleaseUrl(release)} target="_blank" rel="noreferrer">
                    이 버전 열기
                  </a>
                )}
              </div>
              <ul>
                {release.changes.map((change) => <li key={change}>{change}</li>)}
              </ul>
            </section>
          ))}
        </div>
        <p className="version-compatibility-note">
          최신 Analysis XLSX는 이전 버전에서 열리지 않을 수 있습니다. 이전 버전은 결과 재현용으로 사용하고, 지속 분석은 최신 버전에서 진행하십시오.
        </p>
        <div className="version-dialog-footer">
          <button type="button" onClick={closeDialog}>닫기</button>
        </div>
      </dialog>
    </>
  );
}
