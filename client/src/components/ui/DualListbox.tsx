/**
 * DualListbox — generic available / selected picker.
 *
 * Two filterable lists side by side with arrow buttons in the middle that
 * shuttle items between them. The component is fully controlled — pass
 * `selectedIds` and `onChange` — and works with any item shape via the
 * `getId` / `renderItem` props.
 *
 * Used by the Edit AI Agent dialog (Skills Enabled section) but designed
 * to be reusable for any "pick from N, end with M" pattern.
 */

import { useMemo, useState } from "react";
import { Input } from "./input";
import { Button } from "./button";
import { ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft, Search } from "lucide-react";

export interface DualListboxItem {
  id: string;
}

export interface DualListboxProps<T extends DualListboxItem> {
  /** Full pool of items; the component partitions internally by selection. */
  items: T[];
  /** Currently selected ids (controlled). */
  selectedIds: string[];
  /** Fires with the new selected ids on every change. */
  onChange: (ids: string[]) => void;
  /** Extract the id from an item — defaults to `item.id`. */
  getId?: (item: T) => string;
  /** Optional text used to filter items in each pane. */
  getSearchText?: (item: T) => string;
  /** Render a single row inside either pane. */
  renderItem: (item: T, ctx: { side: "available" | "selected" }) => React.ReactNode;
  /** Labels for the two columns. */
  availableLabel?: string;
  selectedLabel?: string;
  /** Optional helper text shown under the columns. */
  helpText?: string;
  /** Cap on rendered items per pane to keep the dialog responsive. */
  maxVisible?: number;
  /** Tailwind classes appended to the outer container. */
  className?: string;
}

export function DualListbox<T extends DualListboxItem>(props: DualListboxProps<T>) {
  const {
    items,
    selectedIds,
    onChange,
    getId = (i: T) => i.id,
    getSearchText,
    renderItem,
    availableLabel = "Available",
    selectedLabel = "Selected",
    helpText,
    maxVisible = 500,
    className = "",
  } = props;

  const [availableFilter, setAvailableFilter] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("");
  // Highlighted (clicked) ids per pane — these are what the arrow buttons move.
  const [availableHighlight, setAvailableHighlight] = useState<Set<string>>(new Set());
  const [selectedHighlight, setSelectedHighlight] = useState<Set<string>>(new Set());

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const partitioned = useMemo(() => {
    const available: T[] = [];
    const selected: T[] = [];
    for (const it of items) {
      if (selectedSet.has(getId(it))) selected.push(it);
      else available.push(it);
    }
    return { available, selected };
  }, [items, selectedSet, getId]);

  const visibleAvailable = useMemo(() => {
    const q = availableFilter.trim().toLowerCase();
    const out = q
      ? partitioned.available.filter((it) =>
          (getSearchText ? getSearchText(it) : getId(it)).toLowerCase().includes(q),
        )
      : partitioned.available;
    return out.slice(0, maxVisible);
  }, [partitioned.available, availableFilter, maxVisible, getId, getSearchText]);
  const visibleSelected = useMemo(() => {
    const q = selectedFilter.trim().toLowerCase();
    const out = q
      ? partitioned.selected.filter((it) =>
          (getSearchText ? getSearchText(it) : getId(it)).toLowerCase().includes(q),
        )
      : partitioned.selected;
    return out.slice(0, maxVisible);
  }, [partitioned.selected, selectedFilter, maxVisible, getId, getSearchText]);

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const moveToSelected = (ids: string[]) => {
    if (ids.length === 0) return;
    const next = Array.from(new Set([...selectedIds, ...ids]));
    onChange(next);
    setAvailableHighlight(new Set());
  };

  const moveToAvailable = (ids: string[]) => {
    if (ids.length === 0) return;
    const removeSet = new Set(ids);
    onChange(selectedIds.filter((id) => !removeSet.has(id)));
    setSelectedHighlight(new Set());
  };

  const moveAllToSelected = () => moveToSelected(visibleAvailable.map(getId));
  const moveAllToAvailable = () => moveToAvailable(visibleSelected.map(getId));

  const moveHighlightedRight = () => moveToSelected(Array.from(availableHighlight));
  const moveHighlightedLeft = () => moveToAvailable(Array.from(selectedHighlight));

  const paneList = (
    side: "available" | "selected",
    rows: T[],
    highlight: Set<string>,
    setHighlight: (next: Set<string>) => void,
  ) => (
    <div className="flex-1 rounded-md border border-border bg-card flex flex-col min-h-0">
      <div className="relative border-b border-border">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder={`Filter ${side === "available" ? availableLabel : selectedLabel}…`}
          value={side === "available" ? availableFilter : selectedFilter}
          onChange={(e) => (side === "available" ? setAvailableFilter(e.target.value) : setSelectedFilter(e.target.value))}
          className="pl-8 h-8 text-sm border-0 focus-visible:ring-0 rounded-none"
        />
      </div>
      <div className="flex-1 overflow-y-auto max-h-72">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No items.</p>
        ) : (
          rows.map((item) => {
            const id = getId(item);
            const isHighlighted = highlight.has(id);
            return (
              <button
                type="button"
                key={id}
                onClick={(e) => {
                  // Cmd/Ctrl-click → toggle; plain click → set as the only highlight.
                  if (e.metaKey || e.ctrlKey) {
                    setHighlight(toggle(highlight, id));
                  } else {
                    setHighlight(new Set([id]));
                  }
                }}
                onDoubleClick={() =>
                  side === "available" ? moveToSelected([id]) : moveToAvailable([id])
                }
                className={`w-full text-left px-2 py-1.5 text-sm border-b border-border/40 last:border-b-0 transition-colors ${
                  isHighlighted ? "bg-indigo-600/10 hover:bg-indigo-600/15" : "hover:bg-secondary/60"
                }`}
              >
                {renderItem(item, { side })}
              </button>
            );
          })
        )}
      </div>
      <div className="border-t border-border px-2 py-1 text-[11px] text-muted-foreground bg-secondary/30">
        {rows.length} of {side === "available" ? partitioned.available.length : partitioned.selected.length}
        {(side === "available" ? availableFilter : selectedFilter).trim() && " (filtered)"}
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-stretch gap-2">
        {paneList("available", visibleAvailable, availableHighlight, setAvailableHighlight)}
        <div className="flex flex-col justify-center gap-1.5 pt-7">
          <Button
            type="button"
            size="icon"
            variant="outline"
            disabled={availableHighlight.size === 0}
            onClick={moveHighlightedRight}
            title="Add highlighted"
            aria-label="Add highlighted to selected"
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            disabled={visibleAvailable.length === 0}
            onClick={moveAllToSelected}
            title={availableFilter.trim() ? "Add all currently filtered" : "Add all"}
            aria-label="Add all to selected"
            className="h-8 w-8"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            disabled={selectedHighlight.size === 0}
            onClick={moveHighlightedLeft}
            title="Remove highlighted"
            aria-label="Remove highlighted from selected"
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            disabled={visibleSelected.length === 0}
            onClick={moveAllToAvailable}
            title={selectedFilter.trim() ? "Remove all currently filtered" : "Remove all"}
            aria-label="Remove all from selected"
            className="h-8 w-8"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
        </div>
        {paneList("selected", visibleSelected, selectedHighlight, setSelectedHighlight)}
      </div>
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

export default DualListbox;
