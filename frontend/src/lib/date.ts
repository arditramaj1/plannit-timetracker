import {
  addDays,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
} from "date-fns";

export const DEFAULT_WEEK_START = Number(process.env.NEXT_PUBLIC_DEFAULT_WEEK_START ?? 1) as
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6;

export function getWeekStart(date: Date) {
  return startOfWeek(date, { weekStartsOn: DEFAULT_WEEK_START });
}

export function getWeekDates(anchor: Date) {
  const start = getWeekStart(anchor);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function getWeekRangeLabel(anchor: Date) {
  const start = getWeekStart(anchor);
  const end = endOfWeek(anchor, { weekStartsOn: DEFAULT_WEEK_START });
  if (start.getMonth() === end.getMonth()) {
    return `${format(start, "MMM d")} - ${format(end, "d, yyyy")}`;
  }
  return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
}

export function formatApiDate(value: Date) {
  return format(value, "yyyy-MM-dd");
}

export function isEntryForSlot(workDate: string, day: Date, hour: number) {
  return workDate === formatApiDate(day) && hour >= 0 && hour <= 23;
}

export function isToday(date: Date) {
  return isSameDay(date, new Date());
}

export function safeParseDate(value: string) {
  return parseISO(value);
}

