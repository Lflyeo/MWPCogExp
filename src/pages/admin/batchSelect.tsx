import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';

export function useRowSelection(ids: string[], resetKey?: unknown) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelected(new Set());
  }, [resetKey]);

  const pageIds = useMemo(() => ids.filter(Boolean), [ids]);
  const selectedOnPage = pageIds.filter((id) => selected.has(id));
  const allChecked = pageIds.length > 0 && selectedOnPage.length === pageIds.length;
  const someChecked = selectedOnPage.length > 0 && !allChecked;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const clear = () => setSelected(new Set());

  return {
    selected,
    count: selectedOnPage.length,
    selectedIds: selectedOnPage,
    allChecked,
    someChecked,
    toggle,
    toggleAll,
    clear,
    isSelected: (id: string) => selected.has(id),
  };
}

export function SelectCheckbox({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label?: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = Boolean(indeterminate);
      }}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
      className="h-4 w-4 rounded border-slate-300 text-slate-800"
    />
  );
}

export function BatchDeleteButton({
  count,
  busy,
  onClick,
}: {
  count: number;
  busy?: boolean;
  onClick: () => void;
}) {
  if (count <= 0) return null;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-500 disabled:opacity-60"
    >
      <Trash2 size={14} />
      {busy ? '删除中…' : `删除所选（${count}）`}
    </button>
  );
}

export async function deleteMany(
  ids: string[],
  remove: (id: string) => Promise<unknown>,
) {
  const results = await Promise.allSettled(ids.map((id) => remove(id)));
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  return { ok, fail: results.length - ok };
}
