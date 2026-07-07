import { useEffect, useRef } from "react";
import type { CheckState } from "../data/types";

type IndeterminateCheckboxProps = {
  checkState: CheckState;
  label: string;
  onChange: (checked: boolean) => void;
};

export function IndeterminateCheckbox({ checkState, label, onChange }: IndeterminateCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = checkState === "mixed";
    }
  }, [checkState]);

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      aria-checked={checkState === "mixed" ? "mixed" : checkState === "checked"}
      checked={checkState === "checked"}
      onChange={(event) => onChange(event.currentTarget.checked)}
    />
  );
}

