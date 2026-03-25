"use client";

import { format } from "date-fns";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { isToday } from "@/lib/date";
import { WorkLogEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

type WeeklyCalendarProps = {
  weekDates: Date[];
  entries: WorkLogEntry[];
  onRangeSelect: (day: Date, startHour: number, endHour: number) => void;
  onEntryClick: (entry: WorkLogEntry) => void;
  allowCreate?: boolean;
  resizingEntryId?: number | null;
};

type DragSelection = {
  day: Date;
  dayKey: string;
  startHour: number;
  endHour: number;
};

type OccupiedSlot = {
  entry: WorkLogEntry;
  isStart: boolean;
};

const hours = Array.from({ length: 24 }, (_, hour) => hour);

function formatHourLabel(hour: number) {
  return `${hour.toString().padStart(2, "0")}:00`;
}

function getDurationHours(entry: WorkLogEntry) {
  return Math.max(1, entry.duration_minutes / 60);
}

function buildOccupiedSlotMap(entries: WorkLogEntry[], ignoredEntryId?: number | null) {
  const occupiedSlotMap = new Map<string, OccupiedSlot>();

  entries.forEach((entry) => {
    if (entry.id === ignoredEntryId) {
      return;
    }

    const durationHours = getDurationHours(entry);
    Array.from({ length: durationHours }, (_, offset) => entry.hour_slot + offset).forEach((hourSlot, offset) => {
      occupiedSlotMap.set(`${entry.work_date}-${hourSlot}`, {
        entry,
        isStart: offset === 0,
      });
    });
  });

  return occupiedSlotMap;
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
  resizingEntryId,
}: WeeklyCalendarProps) {
  const occupiedSlotMap = useMemo(() => buildOccupiedSlotMap(entries, resizingEntryId), [entries, resizingEntryId]);
  const visibleEntries = useMemo(
    () => entries.filter((entry) => entry.id !== resizingEntryId),
    [entries, resizingEntryId],
  );
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(null);
  const suppressEntryClickRef = useRef(false);
  const dayIndexByKey = useMemo(
    () => new Map(weekDates.map((day, index) => [format(day, "yyyy-MM-dd"), index])),
    [weekDates],
  );

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
      <div className="grid min-w-[980px] rounded-3xl border border-border/80 [grid-template-columns:88px_repeat(7,minmax(0,1fr))] [grid-template-rows:auto_repeat(24,92px)]">
        <div className="border-b border-r border-border/80 bg-muted/30 p-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Hours
        </div>

        {weekDates.map((day, dayIndex) => {
          const isCurrentDay = isToday(day);
          return (
            <div
              key={day.toISOString()}
              style={{ gridColumn: dayIndex + 2, gridRow: 1 }}
              className={cn(
                "border-b px-4 py-4 text-center",
                dayIndex < weekDates.length - 1 ? "border-r border-border/80" : null,
                isCurrentDay ? "bg-primary/5" : "bg-muted/20",
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{format(day, "EEE")}</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{format(day, "d")}</p>
              <p className="text-sm text-muted-foreground">{format(day, "MMM")}</p>
            </div>
          );
        })}

        {hours.map((hour) => (
          <div
            key={`hour-${hour}`}
            style={{ gridColumn: 1, gridRow: hour + 2 }}
            className="border-r border-t border-border/80 bg-muted/20 px-4 py-6 text-sm font-medium text-muted-foreground"
          >
            {formatHourLabel(hour)}
          </div>
        ))}

        {weekDates.flatMap((day, dayIndex) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const isCurrentDay = isToday(day);

          return hours.map((hour) => {
            const key = `${dayKey}-${hour}`;
            const occupiedSlot = occupiedSlotMap.get(key);
            const selectionActive = isSelected(dayKey, hour);
            const cellClassName = cn(
              "relative border-t p-2 transition-colors select-none",
              dayIndex < weekDates.length - 1 ? "border-r border-border/80" : null,
              isCurrentDay ? "bg-primary/5" : "bg-white",
              selectionActive ? "bg-primary/10 ring-2 ring-inset ring-primary/30" : null,
            );

            if (allowCreate && !occupiedSlot) {
              return (
                <button
                  key={key}
                  type="button"
                  style={{ gridColumn: dayIndex + 2, gridRow: hour + 2 }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    startSelection(day, hour, dayKey);
                  }}
                  onPointerEnter={() => updateSelection(dayKey, hour)}
                  className={cn(
                    cellClassName,
                    "group text-left",
                    selectionActive ? "bg-primary/10" : isCurrentDay ? "hover:bg-primary/10" : "hover:bg-muted/30",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-border/70 text-muted-foreground transition-opacity",
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
              <div key={key} style={{ gridColumn: dayIndex + 2, gridRow: hour + 2 }} className={cellClassName}>
                {!occupiedSlot ? (
                  <div
                    aria-hidden="true"
                    className="h-full w-full rounded-2xl border border-dashed border-border/50 bg-muted/10"
                  />
                ) : null}
              </div>
            );
          });
        })}

        {visibleEntries.map((entry) => {
          const dayIndex = dayIndexByKey.get(entry.work_date);
          if (dayIndex === undefined) {
            return null;
          }

          const durationHours = getDurationHours(entry);
          return (
            <button
              key={entry.id}
              type="button"
              style={{
                gridColumn: dayIndex + 2,
                gridRow: `${entry.hour_slot + 2} / span ${durationHours}`,
              }}
              onClick={() => {
                if (!suppressEntryClickRef.current) {
                  onEntryClick(entry);
                }
              }}
              className="relative z-10 m-2 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/60 p-3 text-left shadow-sm transition-transform hover:-translate-y-0.5"
            >
              <div
                className="absolute inset-0 rounded-2xl"
                style={{
                  backgroundColor: `${entry.project_color}18`,
                  boxShadow: `inset 4px 0 0 ${entry.project_color}`,
                }}
              />
              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-slate-950">{entry.project_name}</p>
                  <span className="rounded-full bg-white/80 px-2 py-1 text-[11px] font-semibold text-slate-700">
                    {durationHours}h
                  </span>
                </div>
                <p className="mt-2 text-xs font-medium text-slate-600">
                  {formatHourLabel(entry.hour_slot)} to {formatHourLabel(entry.hour_slot + durationHours)}
                </p>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-700">
                  {entry.notes || "No notes added"}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
