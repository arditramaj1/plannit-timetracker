import { WorkLogEntry } from "@/lib/types";

export type EntryLayout = {
  entry: WorkLogEntry;
  columnIndex: number;
  columnCount: number;
  clusterSize: number;
};

export const CALENDAR_HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export function formatHourLabel(hour: number) {
  return `${hour.toString().padStart(2, "0")}:00`;
}

export function getDurationHours(entry: WorkLogEntry) {
  return Math.max(1, entry.duration_minutes / 60);
}

export function getEntryEndHour(entry: WorkLogEntry) {
  return entry.hour_slot + getDurationHours(entry);
}

export function buildOccupiedSlotMap(entries: WorkLogEntry[], ignoredEntryId?: number | null) {
  const occupiedSlotMap = new Map<string, number>();

  entries.forEach((entry) => {
    if (entry.id === ignoredEntryId) {
      return;
    }

    const durationHours = getDurationHours(entry);
    Array.from({ length: durationHours }, (_, offset) => entry.hour_slot + offset).forEach((hourSlot) => {
      const key = `${entry.work_date}-${hourSlot}`;
      occupiedSlotMap.set(key, (occupiedSlotMap.get(key) ?? 0) + 1);
    });
  });

  return occupiedSlotMap;
}

export function buildEntryLayouts(entries: WorkLogEntry[], ignoredEntryId?: number | null) {
  const layouts: EntryLayout[] = [];
  const entriesByDay = new Map<string, WorkLogEntry[]>();

  entries.forEach((entry) => {
    if (entry.id === ignoredEntryId) {
      return;
    }

    const dayEntries = entriesByDay.get(entry.work_date) ?? [];
    dayEntries.push(entry);
    entriesByDay.set(entry.work_date, dayEntries);
  });

  entriesByDay.forEach((dayEntries) => {
    const sortedEntries = [...dayEntries].sort(
      (left, right) =>
        left.hour_slot - right.hour_slot ||
        getEntryEndHour(right) - getEntryEndHour(left) ||
        left.id - right.id,
    );

    let activeColumns: Array<{ columnIndex: number; endHour: number }> = [];
    let currentCluster: EntryLayout[] = [];
    let clusterColumnCount = 1;

    function finalizeCluster() {
      if (currentCluster.length === 0) {
        return;
      }

      currentCluster.forEach((layout) => {
        layouts.push({
          ...layout,
          columnCount: clusterColumnCount,
          clusterSize: currentCluster.length,
        });
      });

      activeColumns = [];
      currentCluster = [];
      clusterColumnCount = 1;
    }

    sortedEntries.forEach((entry) => {
      activeColumns = activeColumns.filter((item) => item.endHour > entry.hour_slot);
      if (activeColumns.length === 0 && currentCluster.length > 0) {
        finalizeCluster();
      }

      const usedColumns = new Set(activeColumns.map((item) => item.columnIndex));
      let columnIndex = 0;
      while (usedColumns.has(columnIndex)) {
        columnIndex += 1;
      }

      currentCluster.push({
        entry,
        columnIndex,
        columnCount: 1,
        clusterSize: 1,
      });
      activeColumns.push({
        columnIndex,
        endHour: getEntryEndHour(entry),
      });
      clusterColumnCount = Math.max(clusterColumnCount, activeColumns.length);
    });

    finalizeCluster();
  });

  return layouts.sort(
    (left, right) =>
      left.entry.work_date.localeCompare(right.entry.work_date) ||
      left.entry.hour_slot - right.entry.hour_slot ||
      left.columnIndex - right.columnIndex ||
      left.entry.id - right.entry.id,
  );
}
