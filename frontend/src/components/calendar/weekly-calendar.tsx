"use client";

import { format } from "date-fns";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { isToday } from "@/lib/date";
import { WorkLogEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

type WeeklyCalendarProps = {
  weekDates: Date[];
  entries: WorkLogEntry[];
  onRangeSelect: (day: Date, startHour: number, endHour: number) => void;
  onEntryClick: (entry: WorkLogEntry) => void;
  allowCreate?: boolean;
};

type DragSelection = {
  day: Date;
  dayKey: string;
  startHour: number;
  endHour: number;
};

const hours = Array.from({ length: 24 }, (_, hour) => hour);

function makeEntryMap(entries: WorkLogEntry[]) {
  return new Map(entries.map((entry) => [`${entry.work_date}-${entry.hour_slot}`, entry]));
}

function getRangeBounds(selection: DragSelection) {
  return {
    startHour: Math.min(selection.startHour, selection.endHour),
    endHour: Math.max(selection.startHour, selection.endHour),
  };
}

export function WeeklyCalendar({
  weekDates,
  entries,
  onRangeSelect,
  onEntryClick,
  allowCreate = true,
}: WeeklyCalendarProps) {
  const entryMap = makeEntryMap(entries);
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(null);
  const suppressEntryClickRef = useRef(false);

  useEffect(() => {
    if (!dragSelection) {
      return;
    }

    function handlePointerUp() {
      setDragSelection((current) => {
        if (!current) {
          return null;
        }
        const { startHour, endHour } = getRangeBounds(current);
        onRangeSelect(current.day, startHour, endHour);
        window.setTimeout(() => {
          suppressEntryClickRef.current = false;
        }, 0);
        return null;
      });
    }

    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragSelection, onRangeSelect]);

  function startSelection(day: Date, hourSlot: number, dayKey: string) {
    suppressEntryClickRef.current = true;
    setDragSelection({
      day,
      dayKey,
      startHour: hourSlot,
      endHour: hourSlot,
    });
  }

  function updateSelection(dayKey: string, hourSlot: number) {
    setDragSelection((current) => {
      if (!current || current.dayKey !== dayKey) {
        return current;
      }
      return { ...current, endHour: hourSlot };
    });
  }

  function isSelected(dayKey: string, hourSlot: number) {
    if (!dragSelection || dragSelection.dayKey !== dayKey) {
      return false;
    }
    const { startHour, endHour } = getRangeBounds(dragSelection);
    return hourSlot >= startHour && hourSlot <= endHour;
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[980px] rounded-3xl border border-border/80">
        <div className="grid grid-cols-[88px_repeat(7,minmax(0,1fr))]">
          <div className="border-b border-r border-border/80 bg-muted/30 p-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Hours
          </div>
          {weekDates.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                "border-b border-border/80 px-4 py-4 text-center",
                isToday(day) ? "bg-primary/5" : "bg-muted/20",
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {format(day, "EEE")}
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{format(day, "d")}</p>
              <p className="text-sm text-muted-foreground">{format(day, "MMM")}</p>
            </div>
          ))}

          {hours.map((hour) => (
            <div key={hour} className="contents">
              <div className="border-r border-t border-border/80 bg-muted/20 px-4 py-6 text-sm font-medium text-muted-foreground">
                {hour.toString().padStart(2, "0")}:00
              </div>
              {weekDates.map((day) => {
                const dayKey = format(day, "yyyy-MM-dd");
                const key = `${dayKey}-${hour}`;
                const entry = entryMap.get(key);
                const selectionActive = isSelected(dayKey, hour);
                const cellClassName = cn(
                  "relative flex min-h-[92px] border-t border-border/80 p-2 text-left transition-colors select-none",
                  isToday(day) ? "bg-primary/5" : "bg-white",
                  selectionActive ? "bg-primary/10 ring-2 ring-inset ring-primary/30" : null,
                );

                if (entry) {
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (!suppressEntryClickRef.current) {
                          onEntryClick(entry);
                        }
                      }}
                      className={cn(cellClassName, isToday(day) ? "hover:bg-primary/10" : "hover:bg-muted/30")}
                    >
                      <div
                        className="w-full rounded-2xl border border-white/60 p-3 shadow-sm transition-transform hover:-translate-y-0.5"
                        style={{
                          backgroundColor: `${entry.project_color}18`,
                          boxShadow: `inset 4px 0 0 ${entry.project_color}`,
                        }}
                      >
                        <p className="truncate text-sm font-semibold text-slate-950">{entry.project_name}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-700">
                          {entry.notes || "No notes added"}
                        </p>
                      </div>
                    </button>
                  );
                }

                if (allowCreate) {
                  return (
                    <button
                      key={key}
                      type="button"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        startSelection(day, hour, dayKey);
                      }}
                      onPointerEnter={() => updateSelection(dayKey, hour)}
                      className={cn(
                        cellClassName,
                        "group",
                        selectionActive ? "bg-primary/10" : isToday(day) ? "hover:bg-primary/10" : "hover:bg-muted/30",
                      )}
                    >
                      <div
                        className={cn(
                          "flex w-full items-center justify-center rounded-2xl border border-dashed border-border/70 text-muted-foreground transition-opacity",
                          selectionActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                        )}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add log
                      </div>
                    </button>
                  );
                }

                return (
                  <div key={key} className={cellClassName}>
                    <div aria-hidden="true" className="w-full rounded-2xl border border-dashed border-border/50 bg-muted/10" />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
