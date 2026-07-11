import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../app/appStore";
import { hasSameSelectionSetMembership } from "../selection/selectionSets";

type EditorMode = "create" | "rename" | "update" | "delete" | null;

export function SelectionSetPanel() {
  const selection = useAppStore((state) => state.selection);
  const selectionSets = useAppStore((state) => state.selectionSets);
  const activeSelectionSetId = useAppStore((state) => state.activeSelectionSetId);
  const selectionSetUndo = useAppStore((state) => state.selectionSetUndo);
  const createSelectionSet = useAppStore((state) => state.createSelectionSet);
  const applySelectionSet = useAppStore((state) => state.applySelectionSet);
  const updateActiveSelectionSet = useAppStore((state) => state.updateActiveSelectionSet);
  const renameSelectionSet = useAppStore((state) => state.renameSelectionSet);
  const deleteSelectionSet = useAppStore((state) => state.deleteSelectionSet);
  const returnToPreviousSelection = useAppStore((state) => state.returnToPreviousSelection);
  const [candidateId, setCandidateId] = useState("");
  const [mode, setMode] = useState<EditorMode>(null);
  const [targetSetId, setTargetSetId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editorTriggerRef = useRef<HTMLElement | null>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const candidateSelectRef = useRef<HTMLSelectElement>(null);
  const manageSummaryRef = useRef<HTMLElement>(null);

  const activeSet = selectionSets.find((selectionSet) => selectionSet.selectionSetId === activeSelectionSetId) ?? null;
  const candidateSet = selectionSets.find((selectionSet) => selectionSet.selectionSetId === candidateId) ?? null;
  const targetSet = selectionSets.find((selectionSet) => selectionSet.selectionSetId === targetSetId) ?? null;
  const activeModified = Boolean(
    activeSet && selection && !hasSameSelectionSetMembership(selection.selectedCurveIds, activeSet.curveIds)
  );
  const selectedCurveIds = selection?.selectedCurveIds ?? new Set<string>();
  const updateAddedCount = targetSet
    ? [...selectedCurveIds].filter((curveId) => !targetSet.curveIds.includes(curveId)).length
    : 0;
  const updateRemovedCount = targetSet
    ? targetSet.curveIds.filter((curveId) => !selectedCurveIds.has(curveId)).length
    : 0;

  useEffect(() => {
    if (candidateId && selectionSets.some((selectionSet) => selectionSet.selectionSetId === candidateId)) return;
    setCandidateId(activeSelectionSetId ?? selectionSets[0]?.selectionSetId ?? "");
  }, [activeSelectionSetId, candidateId, selectionSets]);

  useEffect(() => {
    if (mode === "create" || mode === "rename") inputRef.current?.focus();
  }, [mode]);

  const statusText = useMemo(() => {
    if (!activeSet) return "적용된 세트 없음";
    return `${activeSet.name}${activeModified ? " · 수정됨" : ""}`;
  }, [activeModified, activeSet]);

  if (!selection) return null;

  const cancelEditor = () => {
    setMode(null);
    setTargetSetId(null);
    setName("");
    setMessage(null);
    const trigger = editorTriggerRef.current;
    window.setTimeout(() => {
      const focusTarget = [trigger, candidateSelectRef.current, manageSummaryRef.current, createButtonRef.current]
        .find((element) => element?.isConnected && !element.matches(":disabled"));
      focusTarget?.focus();
    }, 0);
  };

  const submitName = () => {
    const result = mode === "rename" && targetSet
      ? renameSelectionSet(targetSet.selectionSetId, name)
      : createSelectionSet(name);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    if (result.selectionSetId) setCandidateId(result.selectionSetId);
    else if (targetSet) setCandidateId(targetSet.selectionSetId);
    cancelEditor();
  };

  return (
    <section
      className="selection-set-panel"
      aria-label="선택 세트"
      onKeyDown={(event) => {
        if (event.key === "Escape" && mode) {
          event.stopPropagation();
          cancelEditor();
        }
      }}
    >
      <div className="selection-set-heading">
        <strong>선택 세트</strong>
        <span title={statusText} aria-live="polite">현재 적용: {statusText}</span>
      </div>

      {selectionSets.length === 0 && mode !== "create" && (
        <button
          type="button"
          ref={createButtonRef}
          className="selection-set-create"
          disabled={selection.selectedCurveIds.size === 0}
          onClick={(event) => {
            editorTriggerRef.current = event.currentTarget;
            setMode("create");
            setTargetSetId(null);
            setMessage(null);
          }}
        >
          현재 선택을 새 세트로 저장
        </button>
      )}

      {selectionSets.length > 0 && (
        <>
          <div className="selection-set-apply-row">
            <label className="selection-set-candidate">
              <span>적용 후보</span>
              <select
                ref={candidateSelectRef}
                aria-label="적용할 선택 세트"
                value={candidateId}
                title={candidateSet?.name}
                disabled={mode !== null}
                onChange={(event) => {
                  setCandidateId(event.currentTarget.value);
                  setMessage(null);
                }}
              >
                {selectionSets.map((selectionSet) => (
                  <option key={selectionSet.selectionSetId} value={selectionSet.selectionSetId}>
                    {selectionSet.name} ({selectionSet.curveIds.length})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              ref={createButtonRef}
              disabled={!candidateSet || mode !== null}
              onClick={() => {
                if (!candidateSet) return;
                const result = applySelectionSet(candidateSet.selectionSetId);
                setMessage(result.ok ? null : result.message);
              }}
            >
              적용
            </button>
          </div>
          <div className="selection-set-secondary-row">
            <button
              type="button"
              disabled={mode !== null || selection.selectedCurveIds.size === 0}
              onClick={(event) => {
                editorTriggerRef.current = event.currentTarget;
                setMode("create");
                setTargetSetId(null);
                setName("");
                setMessage(null);
              }}
            >
              새 세트
            </button>
            <details className="selection-set-manage">
              <summary ref={manageSummaryRef}>관리</summary>
              <div className="selection-set-manage-actions">
                <button
                  type="button"
                  disabled={mode !== null || !activeSet || !activeModified || selection.selectedCurveIds.size === 0}
                  onClick={(event) => {
                    editorTriggerRef.current = event.currentTarget;
                    setTargetSetId(activeSet?.selectionSetId ?? null);
                    setMode("update");
                  }}
                >
                  현재 선택으로 업데이트
                </button>
                <button
                  type="button"
                  disabled={mode !== null || !candidateSet}
                  onClick={(event) => {
                    editorTriggerRef.current = event.currentTarget;
                    setTargetSetId(candidateSet?.selectionSetId ?? null);
                    setMode("rename");
                    setName(candidateSet?.name ?? "");
                    setMessage(null);
                  }}
                >
                  이름 변경
                </button>
                <button
                  type="button"
                  disabled={mode !== null || !candidateSet}
                  onClick={(event) => {
                    editorTriggerRef.current = event.currentTarget;
                    setTargetSetId(candidateSet?.selectionSetId ?? null);
                    setMode("delete");
                  }}
                >
                  삭제
                </button>
                <button
                  type="button"
                  disabled={mode !== null || !selectionSetUndo}
                  onClick={(event) => {
                    editorTriggerRef.current = event.currentTarget;
                    const result = returnToPreviousSelection();
                    if (result.ok) {
                      setCandidateId(useAppStore.getState().activeSelectionSetId ?? selectionSets[0]?.selectionSetId ?? "");
                    }
                    setMessage(result.ok ? null : result.message);
                  }}
                >
                  적용 전 선택으로 돌아가기
                </button>
              </div>
            </details>
          </div>
        </>
      )}

      {(mode === "create" || mode === "rename") && (
        <div className="selection-set-editor">
          <label htmlFor="selection-set-name">{mode === "create" ? "새 세트 이름" : "변경할 이름"}</label>
          <input
            ref={inputRef}
            id="selection-set-name"
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitName();
            }}
          />
          <div className="selection-set-confirm-actions">
            <button type="button" onClick={submitName}>확인</button>
            <button type="button" onClick={cancelEditor}>취소</button>
          </div>
        </div>
      )}

      {mode === "update" && targetSet && (
        <div
          className="selection-set-confirm"
          role="group"
          aria-label="선택 세트 업데이트 확인"
          aria-describedby="selection-set-update-description"
        >
          <p id="selection-set-update-description">
            {targetSet.name}: {targetSet.curveIds.length}개 → {selection.selectedCurveIds.size}개
            {` (추가 ${updateAddedCount}개 / 제외 ${updateRemovedCount}개)`}
          </p>
          <div className="selection-set-confirm-actions">
            <button
              type="button"
              autoFocus
              onClick={() => {
                const result = updateActiveSelectionSet();
                setMessage(result.ok ? null : result.message);
                if (result.ok) cancelEditor();
              }}
            >
              업데이트
            </button>
            <button type="button" onClick={cancelEditor}>취소</button>
          </div>
        </div>
      )}

      {mode === "delete" && targetSet && (
        <div
          className="selection-set-confirm"
          role="group"
          aria-label="선택 세트 삭제 확인"
          aria-describedby="selection-set-delete-description"
        >
          <p id="selection-set-delete-description">{targetSet.name} 세트만 삭제합니다. 현재 곡선 선택은 유지됩니다.</p>
          <div className="selection-set-confirm-actions">
            <button
              type="button"
              autoFocus
              onClick={() => {
                const result = deleteSelectionSet(targetSet.selectionSetId);
                setMessage(result.ok ? null : result.message);
                if (result.ok) {
                  const nextState = useAppStore.getState();
                  setCandidateId(nextState.activeSelectionSetId ?? nextState.selectionSets[0]?.selectionSetId ?? "");
                  cancelEditor();
                }
              }}
            >
              삭제
            </button>
            <button type="button" onClick={cancelEditor}>취소</button>
          </div>
        </div>
      )}

      {message && <p className="selection-set-message" role="status">{message}</p>}
    </section>
  );
}
