"use client";

import { format } from "date-fns";
import { Plus } from "lucide-react";

import { isToday } from "@/lib/date";
import { WorkLogEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

type WeeklyCalendarProps = {
  weekDates: Date[];
  entries: WorkLogEntry[];
  onSlotClick: (day: Date, hourSlot: number) => void;
  onEntryClick: (entry: WorkLogEntry) => void;
};

const hours = Array.from({ length: 24 }, (_, hour) => hour);

function makeEntryMap(entries: WorkLogEntry[]) {
  return new Map(entries.map((entry) => [`${entry.work_date}-${entry.hour_slot}`, entry]));
}

export function WeeklyCalendar({ weekDates, entries, onSlotClick, onEntryClick }: WeeklyCalendarProps) {
  const entryMap = makeEntryMap(entries);

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
                const key = `${format(day, "yyyy-MM-dd")}-${hour}`;
                const entry = entryMap.get(key);

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => (entry ? onEntryClick(entry) : onSlotClick(day, hour))}
                    className={cn(
                      "group relative flex min-h-[92px] border-t border-border/80 p-2 text-left transition-colors",
                      isToday(day) ? "bg-primary/5 hover:bg-primary/10" : "bg-white hover:bg-muted/30",
                    )}
                  >
                    {entry ? (
                      <div
                        className="w-full rounded-2xl border border-white/60 p-3 shadow-sm transition-transform group-hover:-translate-y-0.5"
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
                    ) : (
                      <div className="flex w-full items-center justify-center rounded-2xl border border-dashed border-border/70 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                        <Plus className="mr-2 h-4 w-4" />
                        Add log
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

