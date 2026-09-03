import { useEffect, useMemo, useRef, useState } from "react";
import type { Curve, PcrDataset } from "../data/types";

type Props = {
  dataset: PcrDataset;
  mode: "exclude" | "restore";
  candidateCurveIds: string[];
  targetLabel?: string;
  onExclude: (curveIds: string[]) => void;
  onRestore: (curveIds: string[]) => void;
  onClose: () => void;
};

export function DataExclusionDialog({
  dataset,
  mode,
  candidateCurveIds,
  targetLabel,
  onExclude,
  onRestore,
  onClose
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const curves = useMemo(() => {
    const candidateIds = new Set(candidateCurveIds);
    return dataset.curves.filter((curve) => candidateIds.has(curve.curveId));
  }, [candidateCurveIds, dataset.curves]);
  const sourceBuckets = useMemo(() => createSourceBuckets(curves), [curves]);
  const [scope, setScope] = useState(() => sourceBuckets.length === 1 ? sourceBuckets[0].key : "");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }, []);

  const scopedCurveIds = scope === "all"
    ? curves.map((curve) => curve.curveId)
    : sourceBuckets.find((bucket) => bucket.key === scope)?.curves.map((curve) => curve.curveId) ?? [];

  return (
    <dialog
      ref={dialogRef}
      className="data-exclusion-dialog"
      aria-labelledby="data-exclusion-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="data-exclusion-surface">
        <header className="data-exclusion-header">
          <div>
            <h2 id="data-exclusion-title">{mode === "exclude" ? "분석에서 제외" : "제외 항목 관리"}</h2>
            <p>{mode === "exclude" ? targetLabel : `${curves.length}개 곡선이 현재 분석에서 제외되어 있습니다.`}</p>
          </div>
          <button type="button" className="icon-button" aria-label="창 닫기" title="닫기" onClick={onClose}>×</button>
        </header>

        {mode === "exclude" ? (
          <div className="data-exclusion-body">
            <p className="data-exclusion-note">
              원본 형광값은 삭제하지 않습니다. 선택한 곡선만 Plot, Threshold 및 선택 데이터 출력에서 제외합니다.
            </p>
            {curves.length === 1 ? (
              <CurveIdentity curve={curves[0]} />
            ) : (
              <fieldset className="data-exclusion-scopes">
                <legend>제외 범위</legend>
                {sourceBuckets.map((bucket, index) => (
                  <label key={bucket.key}>
                    <input
                      type="radio"
                      name="exclusion-scope"
                      value={bucket.key}
                      checked={scope === bucket.key}
                      onChange={() => setScope(bucket.key)}
                    />
                    <span>입력 #{index + 1} · {formatSourceBucket(bucket)}</span>
                  </label>
                ))}
                {sourceBuckets.length > 1 && (
                  <label>
                    <input
                      type="radio"
                      name="exclusion-scope"
                      value="all"
                      checked={scope === "all"}
                      onChange={() => setScope("all")}
                    />
                    <span>동일 이름 전체 · {curves.length}개 곡선</span>
                  </label>
                )}
              </fieldset>
            )}
            <footer className="data-exclusion-footer">
              <button type="button" onClick={onClose}>취소</button>
              <button
                type="button"
                className="primary-action"
                disabled={scopedCurveIds.length === 0}
                onClick={() => onExclude(scopedCurveIds)}
              >
                {scopedCurveIds.length}개 제외
              </button>
            </footer>
          </div>
        ) : (
          <div className="data-exclusion-body">
            <p className="data-exclusion-note">복구된 곡선은 자동 선택되지 않습니다.</p>
            <div className="excluded-curve-list">
              {curves.map((curve) => (
                <div className="excluded-curve-item" key={curve.curveId}>
                  <CurveIdentity curve={curve} />
                  <button type="button" onClick={() => onRestore([curve.curveId])}>복구</button>
                </div>
              ))}
            </div>
            <footer className="data-exclusion-footer">
              <button type="button" onClick={onClose}>닫기</button>
              <button type="button" className="primary-action" onClick={() => onRestore(curves.map((curve) => curve.curveId))}>
                모두 복구
              </button>
            </footer>
          </div>
        )}
      </div>
    </dialog>
  );
}

function CurveIdentity({ curve }: { curve: Curve }) {
  return (
    <div className="curve-identity">
      <strong>{curve.specimenLabel} | {curve.reagentLabel}</strong>
      <span>{curve.source.fileName} · {curve.source.sheetName} · {curve.source.columnLetter}열</span>
      <span>Source ID: {curve.source.sourceInstanceId ?? "legacy source"}</span>
      <code>{curve.curveId}</code>
    </div>
  );
}

function createSourceBuckets(curves: Curve[]) {
  const buckets = new Map<string, Curve[]>();
  curves.forEach((curve) => {
    const key = curve.source.sourceInstanceId ?? [curve.source.fileName, curve.source.sheetName, curve.source.sheetIndex].join("|");
    const bucket = buckets.get(key) ?? [];
    bucket.push(curve);
    buckets.set(key, bucket);
  });
  return [...buckets].map(([key, bucketCurves]) => ({ key, curves: bucketCurves }));
}

function formatSourceBucket(bucket: { curves: Curve[] }) {
  const first = bucket.curves[0];
  const columns = bucket.curves.map((curve) => curve.source.columnLetter).join(", ");
  return `${first.source.fileName} · ${first.source.sheetName} · ${columns}열 · ${bucket.curves.length}개 · Source ID ${first.source.sourceInstanceId ?? "legacy"}`;
}
