import { addWeeks, endOfMonth, format, isSameMonth, startOfMonth } from "date-fns";

import { buildEntryLayouts, formatHourLabel, getDurationHours } from "@/lib/calendar-layout";
import { formatApiDate, getWeekDates, getWeekStart, safeParseDate } from "@/lib/date";
import { Project, User, WorkLogEntry } from "@/lib/types";

const PAGE_PIXEL_WIDTH = 1684;
const PAGE_PIXEL_HEIGHT = 1191;
const PDF_PAGE_WIDTH = 842;
const PDF_PAGE_HEIGHT = 595;
const PAGE_PADDING = 56;
const HEADER_HEIGHT = 220;
const HOURS_COLUMN_WIDTH = 108;
const DAY_HEADER_HEIGHT = 110;

type WeeklyCalendarPage = {
  entries: WorkLogEntry[];
  weekDates: Date[];
};

type PdfImage = {
  bytes: Uint8Array;
  width: number;
  height: number;
};

type MonthlyCalendarPdfOptions = {
  referenceDate: Date;
  user: Pick<User, "display_name">;
  project?: Pick<Project, "code" | "name"> | null;
  entries: WorkLogEntry[];
};

const DETAIL_TABLE_COLUMNS = [
  { key: "date", label: "Date", width: 140 },
  { key: "time", label: "Time", width: 156 },
  { key: "duration", label: "Duration", width: 110 },
  { key: "code", label: "Code", width: 100 },
  { key: "project", label: "Project", width: 250 },
  { key: "notes", label: "Notes", width: 816 },
] as const;

type DetailColumnKey = (typeof DETAIL_TABLE_COLUMNS)[number]["key"];

type DetailTableRow = {
  rowHeight: number;
  cells: Record<DetailColumnKey, string[]>;
};

function normalizeHexColor(color: string | undefined) {
  const value = color?.trim() ?? "";
  if (/^#[0-9a-fA-F]{6}$/.test(value)) {
    return value;
  }
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  return "#CBD5E1";
}

function hexToRgb(hexColor: string) {
  const normalized = normalizeHexColor(hexColor).slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function darkenHexColor(hexColor: string, amount: number) {
  const { r, g, b } = hexToRgb(hexColor);
  const nextFactor = Math.max(0, 1 - amount);
  const nextColor = [r, g, b]
    .map((channel) => Math.max(0, Math.min(255, Math.round(channel * nextFactor))))
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("");
  return `#${nextColor}`;
}

function withAlpha(hexColor: string, alpha: number) {
  const { r, g, b } = hexToRgb(hexColor);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getTextColorForBackground(hexColor: string) {
  const { r, g, b } = hexToRgb(hexColor);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 158 ? "#F8FAFC" : "#0F172A";
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const limitedRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + limitedRadius, y);
  context.lineTo(x + width - limitedRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + limitedRadius);
  context.lineTo(x + width, y + height - limitedRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - limitedRadius, y + height);
  context.lineTo(x + limitedRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - limitedRadius);
  context.lineTo(x, y + limitedRadius);
  context.quadraticCurveTo(x, y, x + limitedRadius, y);
  context.closePath();
}

function fillRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string,
) {
  context.save();
  context.fillStyle = color;
  drawRoundedRect(context, x, y, width, height, radius);
  context.fill();
  context.restore();
}

function strokeRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string,
  lineWidth = 1,
) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  drawRoundedRect(context, x, y, width, height, radius);
  context.stroke();
  context.restore();
}

function drawTopRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const limitedRadius = Math.min(radius, width / 2, height);
  context.beginPath();
  context.moveTo(x, y + height);
  context.lineTo(x, y + limitedRadius);
  context.quadraticCurveTo(x, y, x + limitedRadius, y);
  context.lineTo(x + width - limitedRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + limitedRadius);
  context.lineTo(x + width, y + height);
  context.closePath();
}

function fillTopRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string,
) {
  context.save();
  context.fillStyle = color;
  drawTopRoundedRect(context, x, y, width, height, radius);
  context.fill();
  context.restore();
}

function trimTextToWidth(context: CanvasRenderingContext2D, value: string, maxWidth: number) {
  if (context.measureText(value).width <= maxWidth) {
    return value;
  }

  let trimmed = value;
  while (trimmed.length > 0 && context.measureText(`${trimmed}...`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }

  return trimmed ? `${trimmed}...` : "...";
}

function wrapText(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  maxLines: number,
) {
  const sanitized = value.replace(/\s+/g, " ").trim();
  if (!sanitized) {
    return [];
  }

  const words = sanitized.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    const candidateLine = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(candidateLine).width <= maxWidth) {
      currentLine = candidateLine;
      return;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = "";
    }

    if (lines.length >= maxLines) {
      return;
    }

    currentLine =
      context.measureText(word).width <= maxWidth ? word : trimTextToWidth(context, word, maxWidth);
  });

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  if (lines.length > maxLines) {
    return lines.slice(0, maxLines);
  }

  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = trimTextToWidth(context, lines[maxLines - 1], maxWidth);
  }

  return lines;
}

function drawPill(
  context: CanvasRenderingContext2D,
  {
    x,
    y,
    text,
    backgroundColor,
    textColor,
    font = "600 18px ui-sans-serif, system-ui, sans-serif",
    paddingX = 14,
    height = 34,
  }: {
    x: number;
    y: number;
    text: string;
    backgroundColor: string;
    textColor: string;
    font?: string;
    paddingX?: number;
    height?: number;
  },
) {
  context.save();
  context.font = font;
  const width = context.measureText(text).width + paddingX * 2;
  fillRoundedRect(context, x, y, width, height, height / 2, backgroundColor);
  context.fillStyle = textColor;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, x + width / 2, y + height / 2 + 1);
  context.restore();
  return width;
}

function drawClampedPill(
  context: CanvasRenderingContext2D,
  {
    maxWidth,
    ...pillOptions
  }: {
    x: number;
    y: number;
    text: string;
    backgroundColor: string;
    textColor: string;
    font?: string;
    paddingX?: number;
    height?: number;
    maxWidth: number;
  },
) {
  const font = pillOptions.font ?? "600 18px ui-sans-serif, system-ui, sans-serif";
  const paddingX = pillOptions.paddingX ?? 14;
  context.save();
  context.font = font;
  const availableTextWidth = Math.max(32, maxWidth - paddingX * 2);
  const clampedText = trimTextToWidth(context, pillOptions.text, availableTextWidth);
  context.restore();
  return drawPill(context, {
    ...pillOptions,
    font,
    paddingX,
    text: clampedText,
  });
}

function buildMonthPages(referenceDate: Date, entries: WorkLogEntry[]) {
  const pages: WeeklyCalendarPage[] = [];
  const monthStart = startOfMonth(referenceDate);
  const lastWeekStart = getWeekStart(endOfMonth(referenceDate));
  let cursor = getWeekStart(monthStart);

  while (cursor <= lastWeekStart) {
    const weekDates = getWeekDates(cursor);
    const weekDateKeys = new Set(weekDates.map((date) => formatApiDate(date)));
    pages.push({
      weekDates,
      entries: entries.filter((entry) => weekDateKeys.has(entry.work_date)),
    });
    cursor = addWeeks(cursor, 1);
  }

  return pages;
}

function formatHours(totalHours: number) {
  return Number.isInteger(totalHours) ? String(totalHours) : totalHours.toFixed(1);
}

function getProjectFilterLabel(project: MonthlyCalendarPdfOptions["project"]) {
  return project ? [project.code, project.name].filter(Boolean).join(" - ") : "All projects";
}

function getEntryProjectLabel(entry: WorkLogEntry) {
  return entry.project_code || entry.project_name;
}

function sortEntries(entries: WorkLogEntry[]) {
  return [...entries].sort(
    (left, right) =>
      left.work_date.localeCompare(right.work_date) ||
      left.hour_slot - right.hour_slot ||
      left.project_name.localeCompare(right.project_name) ||
      left.id - right.id,
  );
}

function createCanvasContext() {
  if (typeof document === "undefined") {
    throw new Error("PDF export is only available in the browser.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = PAGE_PIXEL_WIDTH;
  canvas.height = PAGE_PIXEL_HEIGHT;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to prepare the PDF export canvas.");
  }

  return { canvas, context };
}

function buildDetailTableRows(entries: WorkLogEntry[]) {
  const { context } = createCanvasContext();
  const rows = sortEntries(entries).map((entry) => {
    const durationHours = getDurationHours(entry);
    const cells: DetailTableRow["cells"] = {
      date: [],
      time: [],
      duration: [],
      code: [],
      project: [],
      notes: [],
    };

    context.font = "500 16px ui-sans-serif, system-ui, sans-serif";
    cells.date = wrapText(context, format(safeParseDate(entry.work_date), "EEE, MMM d, yyyy"), 116, 3);
    cells.time = wrapText(
      context,
      `${formatHourLabel(entry.hour_slot)} - ${formatHourLabel(entry.hour_slot + durationHours)}`,
      132,
      3,
    );
    cells.duration = wrapText(context, `${formatHours(durationHours)}h`, 86, 2);
    cells.code = wrapText(context, entry.project_code || "—", 76, 2);
    cells.project = wrapText(context, entry.project_name, 226, 4);
    cells.notes = wrapText(context, entry.notes || "No notes added", 792, 10);

    const lineCount = Math.max(...Object.values(cells).map((lines) => Math.max(1, lines.length)));
    return {
      cells,
      rowHeight: Math.max(46, 18 + lineCount * 20),
    };
  });

  return rows.length > 0
    ? rows
    : [
        {
          cells: {
            date: ["No work logs matched the selected month."],
            time: [""],
            duration: [""],
            code: [""],
            project: [""],
            notes: [""],
          },
          rowHeight: 56,
        },
      ];
}

function paginateDetailTableRows(rows: DetailTableRow[]) {
  const pages: DetailTableRow[][] = [];
  const tableHeaderHeight = 44;
  const tableTop = HEADER_HEIGHT + 36;
  const tableBottom = PAGE_PIXEL_HEIGHT - 88;
  const availableHeight = tableBottom - tableTop - tableHeaderHeight;
  let currentPage: DetailTableRow[] = [];
  let usedHeight = 0;

  rows.forEach((row) => {
    if (currentPage.length > 0 && usedHeight + row.rowHeight > availableHeight) {
      pages.push(currentPage);
      currentPage = [];
      usedHeight = 0;
    }

    currentPage.push(row);
    usedHeight += row.rowHeight;
  });

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

function drawCompactCalendarEntry(
  context: CanvasRenderingContext2D,
  {
    entryX,
    entryY,
    entryWidth,
    entryHeight,
    label,
    durationHours,
    textColor,
  }: {
    entryX: number;
    entryY: number;
    entryWidth: number;
    entryHeight: number;
    label: string;
    durationHours: number;
    textColor: string;
  },
) {
  const centerX = entryX + entryWidth / 2;
  const safeWidth = Math.max(24, entryWidth - 16);
  const normalizedLabel = label.toUpperCase();

  context.save();
  context.fillStyle = textColor;
  context.textAlign = "center";

  if (entryHeight < 34) {
    context.textBaseline = "middle";
    context.font = "700 11px ui-sans-serif, system-ui, sans-serif";
    const singleLine = trimTextToWidth(context, `${normalizedLabel} ${durationHours}h`, safeWidth);
    context.fillText(singleLine, centerX, entryY + entryHeight / 2 + 0.5);
    context.restore();
    return;
  }

  const durationFontSize = entryHeight < 54 ? 12 : 14;
  const codeFontSize = entryHeight < 54 ? 13 : 16;
  const durationLineHeight = durationFontSize + 4;
  const codeLineHeight = codeFontSize + 4;
  const codeMaxLines = entryHeight < 54 ? 1 : 2;

  context.font = `700 ${codeFontSize}px ui-sans-serif, system-ui, sans-serif`;
  const titleLines = wrapText(context, normalizedLabel, safeWidth, codeMaxLines);
  const totalContentHeight = durationLineHeight + 4 + titleLines.length * codeLineHeight;
  let cursorY = entryY + Math.max(6, (entryHeight - totalContentHeight) / 2);

  context.textBaseline = "top";
  context.font = `700 ${durationFontSize}px ui-sans-serif, system-ui, sans-serif`;
  context.fillText(`${durationHours}h`, centerX, cursorY);
  cursorY += durationLineHeight + 4;

  context.font = `700 ${codeFontSize}px ui-sans-serif, system-ui, sans-serif`;
  titleLines.forEach((line) => {
    context.fillText(line, centerX, cursorY);
    cursorY += codeLineHeight;
  });
  context.restore();
}

function renderWeeklyCalendarPage(
  page: WeeklyCalendarPage,
  options: MonthlyCalendarPdfOptions,
  pageIndex: number,
  pageCount: number,
) {
  const { canvas, context } = createCanvasContext();

  const backgroundGradient = context.createLinearGradient(0, 0, PAGE_PIXEL_WIDTH, PAGE_PIXEL_HEIGHT);
  backgroundGradient.addColorStop(0, "#F8FAFC");
  backgroundGradient.addColorStop(0.5, "#EFF6FF");
  backgroundGradient.addColorStop(1, "#F8FAFC");
  context.fillStyle = backgroundGradient;
  context.fillRect(0, 0, PAGE_PIXEL_WIDTH, PAGE_PIXEL_HEIGHT);

  const monthLabel = format(options.referenceDate, "MMMM yyyy");
  const weekLabel = `${format(page.weekDates[0], "MMM d")} - ${format(page.weekDates[6], "MMM d, yyyy")}`;
  const generatedLabel = format(new Date(), "MMM d, yyyy 'at' HH:mm");
  const weekHours = page.entries.reduce((sum, entry) => sum + entry.duration_minutes, 0) / 60;
  const projectLabel = getProjectFilterLabel(options.project);
  const metricCardWidth = 324;
  const metricCardHeight = 108;
  const metricCardX = PAGE_PIXEL_WIDTH - PAGE_PADDING - metricCardWidth;
  const metricCardY = 44;
  const leftHeaderWidth = metricCardX - PAGE_PADDING - 24;

  context.save();
  context.shadowColor = "rgba(15, 23, 42, 0.08)";
  context.shadowBlur = 28;
  fillRoundedRect(
    context,
    PAGE_PADDING,
    HEADER_HEIGHT,
    PAGE_PIXEL_WIDTH - PAGE_PADDING * 2,
    PAGE_PIXEL_HEIGHT - HEADER_HEIGHT - PAGE_PADDING,
    34,
    "#FFFFFF",
  );
  context.restore();
  strokeRoundedRect(
    context,
    PAGE_PADDING,
    HEADER_HEIGHT,
    PAGE_PIXEL_WIDTH - PAGE_PADDING * 2,
    PAGE_PIXEL_HEIGHT - HEADER_HEIGHT - PAGE_PADDING,
    34,
    "#D9E2EC",
  );

  context.fillStyle = "#0F172A";
  context.font = "700 50px ui-sans-serif, system-ui, sans-serif";
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillText("Client Calendar Report", PAGE_PADDING, 78);

  context.fillStyle = "#334155";
  context.font = "500 24px ui-sans-serif, system-ui, sans-serif";
  context.fillText(trimTextToWidth(context, `${monthLabel} • ${options.user.display_name}`, leftHeaderWidth), PAGE_PADDING, 116);
  context.fillStyle = "#64748B";
  context.font = "500 18px ui-sans-serif, system-ui, sans-serif";
  context.fillText(trimTextToWidth(context, `Generated ${generatedLabel}`, leftHeaderWidth), PAGE_PADDING, 146);

  drawClampedPill(context, {
    x: PAGE_PADDING,
    y: 164,
    maxWidth: leftHeaderWidth,
    text: `Project: ${projectLabel}`,
    backgroundColor: "#E2E8F0",
    textColor: "#334155",
    font: "600 18px ui-sans-serif, system-ui, sans-serif",
  });

  fillRoundedRect(context, metricCardX, metricCardY, metricCardWidth, metricCardHeight, 28, "#0F172A");
  context.fillStyle = "#E2E8F0";
  context.font = "600 18px ui-sans-serif, system-ui, sans-serif";
  context.textAlign = "left";
  context.fillText(`Week ${pageIndex + 1} of ${pageCount}`, metricCardX + 28, metricCardY + 34);
  context.fillStyle = "#FFFFFF";
  context.font = "700 34px ui-sans-serif, system-ui, sans-serif";
  context.fillText(trimTextToWidth(context, weekLabel, metricCardWidth - 56), metricCardX + 28, metricCardY + 72);
  context.fillStyle = "#93C5FD";
  context.font = "600 18px ui-sans-serif, system-ui, sans-serif";
  context.fillText(`${formatHours(weekHours)} hours logged`, metricCardX + 28, metricCardY + 96);

  const panelX = PAGE_PADDING;
  const panelY = HEADER_HEIGHT;
  const panelWidth = PAGE_PIXEL_WIDTH - PAGE_PADDING * 2;
  const panelHeight = PAGE_PIXEL_HEIGHT - HEADER_HEIGHT - PAGE_PADDING;
  const bodyX = panelX + HOURS_COLUMN_WIDTH;
  const bodyY = panelY + DAY_HEADER_HEIGHT;
  const bodyWidth = panelWidth - HOURS_COLUMN_WIDTH;
  const bodyHeight = panelHeight - DAY_HEADER_HEIGHT;
  const dayColumnWidth = bodyWidth / 7;
  const hourRowHeight = bodyHeight / 24;

  fillRoundedRect(context, panelX, panelY, HOURS_COLUMN_WIDTH, panelHeight, 34, "#F8FAFC");
  fillRoundedRect(context, panelX, panelY, panelWidth, DAY_HEADER_HEIGHT, 34, "#F8FAFC");

  page.weekDates.forEach((day, dayIndex) => {
    const dayX = bodyX + dayIndex * dayColumnWidth;
    const isInMonth = isSameMonth(day, options.referenceDate);
    fillRoundedRect(
      context,
      dayX,
      panelY,
      dayColumnWidth,
      DAY_HEADER_HEIGHT,
      26,
      isInMonth ? "#EFF6FF" : "#F8FAFC",
    );

    context.fillStyle = isInMonth ? "#0F172A" : "#64748B";
    context.textAlign = "center";
    context.font = "700 18px ui-sans-serif, system-ui, sans-serif";
    context.fillText(format(day, "EEE").toUpperCase(), dayX + dayColumnWidth / 2, panelY + 32);
    context.font = "700 34px ui-sans-serif, system-ui, sans-serif";
    context.fillText(format(day, "d"), dayX + dayColumnWidth / 2, panelY + 70);
    context.font = "500 18px ui-sans-serif, system-ui, sans-serif";
    context.fillStyle = isInMonth ? "#475569" : "#94A3B8";
    context.fillText(format(day, "MMM"), dayX + dayColumnWidth / 2, panelY + 94);
  });

  Array.from({ length: 24 }, (_, hour) => hour).forEach((hour) => {
    const rowY = bodyY + hour * hourRowHeight;
    const rowLabelY = rowY + hourRowHeight / 2;

    fillRoundedRect(
      context,
      panelX,
      rowY,
      HOURS_COLUMN_WIDTH,
      hourRowHeight,
      0,
      hour % 2 === 0 ? "#F8FAFC" : "#F1F5F9",
    );
    context.fillStyle = "#475569";
    context.textAlign = "right";
    context.textBaseline = "middle";
    context.font = "600 18px ui-sans-serif, system-ui, sans-serif";
    context.fillText(formatHourLabel(hour), panelX + HOURS_COLUMN_WIDTH - 16, rowLabelY);

    page.weekDates.forEach((day, dayIndex) => {
      const dayX = bodyX + dayIndex * dayColumnWidth;
      const isInMonth = isSameMonth(day, options.referenceDate);
      context.fillStyle =
        hour % 2 === 0
          ? isInMonth
            ? "#FFFFFF"
            : "#F8FAFC"
          : isInMonth
            ? "#FCFDFF"
            : "#F1F5F9";
      context.fillRect(dayX, rowY, dayColumnWidth, hourRowHeight);
    });
  });

  context.strokeStyle = "#D9E2EC";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(panelX + HOURS_COLUMN_WIDTH, panelY);
  context.lineTo(panelX + HOURS_COLUMN_WIDTH, panelY + panelHeight);
  context.moveTo(panelX, panelY + DAY_HEADER_HEIGHT);
  context.lineTo(panelX + panelWidth, panelY + DAY_HEADER_HEIGHT);

  page.weekDates.forEach((_, dayIndex) => {
    const columnX = bodyX + dayIndex * dayColumnWidth;
    context.moveTo(columnX, panelY);
    context.lineTo(columnX, panelY + panelHeight);
  });

  Array.from({ length: 25 }, (_, index) => index).forEach((rowIndex) => {
    const lineY = bodyY + rowIndex * hourRowHeight;
    context.moveTo(panelX, lineY);
    context.lineTo(panelX + panelWidth, lineY);
  });
  context.stroke();

  const dayIndexByKey = new Map(page.weekDates.map((day, dayIndex) => [formatApiDate(day), dayIndex]));
  const layouts = buildEntryLayouts(page.entries);

  layouts.forEach((layout) => {
    const dayIndex = dayIndexByKey.get(layout.entry.work_date);
    if (dayIndex === undefined) {
      return;
    }

    const durationHours = getDurationHours(layout.entry);
    const columnGap = 10;
    const horizontalInset = 12;
    const verticalInset = durationHours <= 1 ? 3 : 8;
    const totalGap = Math.max(0, layout.columnCount - 1) * columnGap;
    const entryWidth =
      (dayColumnWidth - horizontalInset * 2 - totalGap) / Math.max(1, layout.columnCount);
    const entryHeight = Math.max(12, durationHours * hourRowHeight - verticalInset * 2);
    const entryX =
      bodyX +
      dayIndex * dayColumnWidth +
      horizontalInset +
      layout.columnIndex * (entryWidth + columnGap);
    const entryY = bodyY + layout.entry.hour_slot * hourRowHeight + verticalInset;
    const baseColor = normalizeHexColor(layout.entry.project_color);
    const accentColor = darkenHexColor(baseColor, 0.18);
    const textColor = getTextColorForBackground(baseColor);
    const isCompact =
      layout.clusterSize > 1 || layout.columnCount > 1 || entryWidth < 168 || entryHeight < 88;
    const accentInset = entryHeight < 32 ? 4 : 6;
    const accentHeight = Math.max(10, entryHeight - accentInset * 2);

    context.save();
    context.shadowColor = withAlpha("#0F172A", 0.16);
    context.shadowBlur = entryHeight < 40 ? 8 : 18;
    context.shadowOffsetY = entryHeight < 40 ? 3 : 8;
    fillRoundedRect(context, entryX, entryY, entryWidth, entryHeight, 22, baseColor);
    context.restore();

    fillRoundedRect(context, entryX + accentInset, entryY + accentInset, 10, accentHeight, 5, accentColor);
    strokeRoundedRect(context, entryX, entryY, entryWidth, entryHeight, 22, withAlpha("#FFFFFF", 0.42), 2);

    if (isCompact) {
      drawCompactCalendarEntry(context, {
        entryX,
        entryY,
        entryWidth,
        entryHeight,
        label: getEntryProjectLabel(layout.entry),
        durationHours,
        textColor,
      });
      return;
    }

    const innerPadding = 22;
    drawPill(context, {
      x: entryX + entryWidth - 88,
      y: entryY + 18,
      text: `${durationHours}h`,
      backgroundColor: withAlpha("#FFFFFF", 0.86),
      textColor: "#334155",
      font: "700 16px ui-sans-serif, system-ui, sans-serif",
      paddingX: 12,
      height: 30,
    });

    context.save();
    context.textAlign = "left";
    context.textBaseline = "top";
    context.fillStyle = textColor;
    context.font = "700 22px ui-sans-serif, system-ui, sans-serif";
    const titleLines = wrapText(context, getEntryProjectLabel(layout.entry), entryWidth - innerPadding * 2 - 92, 2);
    titleLines.forEach((line, lineIndex) => {
      context.fillText(line, entryX + innerPadding, entryY + 18 + lineIndex * 24);
    });
    context.restore();
  });

  context.fillStyle = "#64748B";
  context.textAlign = "right";
  context.textBaseline = "alphabetic";
  context.font = "500 18px ui-sans-serif, system-ui, sans-serif";
  context.fillText(`Page ${pageIndex + 1} of ${pageCount}`, PAGE_PIXEL_WIDTH - PAGE_PADDING, PAGE_PIXEL_HEIGHT - 18);

  return canvas;
}

function renderDetailedWorklogPage(
  rows: DetailTableRow[],
  options: MonthlyCalendarPdfOptions,
  detailPageIndex: number,
  detailPageCount: number,
  pageIndex: number,
  pageCount: number,
) {
  const { canvas, context } = createCanvasContext();
  const monthLabel = format(options.referenceDate, "MMMM yyyy");
  const generatedLabel = format(new Date(), "MMM d, yyyy 'at' HH:mm");
  const totalHours = options.entries.reduce((sum, entry) => sum + entry.duration_minutes, 0) / 60;
  const totalEntries = options.entries.length;
  const projectLabel = getProjectFilterLabel(options.project);
  const metricCardWidth = 324;
  const metricCardHeight = 108;
  const metricCardX = PAGE_PIXEL_WIDTH - PAGE_PADDING - metricCardWidth;
  const metricCardY = 44;
  const leftHeaderWidth = metricCardX - PAGE_PADDING - 24;
  const panelX = PAGE_PADDING;
  const panelY = HEADER_HEIGHT;
  const panelWidth = PAGE_PIXEL_WIDTH - PAGE_PADDING * 2;
  const panelHeight = PAGE_PIXEL_HEIGHT - HEADER_HEIGHT - PAGE_PADDING;
  const tableX = panelX;
  const tableY = panelY;
  const tableWidth = panelWidth;
  const tableHeaderHeight = 44;

  const backgroundGradient = context.createLinearGradient(0, 0, PAGE_PIXEL_WIDTH, PAGE_PIXEL_HEIGHT);
  backgroundGradient.addColorStop(0, "#F8FAFC");
  backgroundGradient.addColorStop(0.5, "#F1F5F9");
  backgroundGradient.addColorStop(1, "#EFF6FF");
  context.fillStyle = backgroundGradient;
  context.fillRect(0, 0, PAGE_PIXEL_WIDTH, PAGE_PIXEL_HEIGHT);

  context.save();
  context.shadowColor = "rgba(15, 23, 42, 0.08)";
  context.shadowBlur = 28;
  fillRoundedRect(context, panelX, panelY, panelWidth, panelHeight, 34, "#FFFFFF");
  context.restore();
  strokeRoundedRect(context, panelX, panelY, panelWidth, panelHeight, 34, "#D9E2EC");

  context.fillStyle = "#0F172A";
  context.font = "700 50px ui-sans-serif, system-ui, sans-serif";
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillText("Detailed Work Log", PAGE_PADDING, 78);

  context.fillStyle = "#334155";
  context.font = "500 24px ui-sans-serif, system-ui, sans-serif";
  context.fillText(trimTextToWidth(context, `${monthLabel} • ${options.user.display_name}`, leftHeaderWidth), PAGE_PADDING, 116);
  context.fillStyle = "#64748B";
  context.font = "500 18px ui-sans-serif, system-ui, sans-serif";
  context.fillText(trimTextToWidth(context, `Generated ${generatedLabel}`, leftHeaderWidth), PAGE_PADDING, 146);

  drawClampedPill(context, {
    x: PAGE_PADDING,
    y: 164,
    maxWidth: leftHeaderWidth,
    text: `Project: ${projectLabel}`,
    backgroundColor: "#E2E8F0",
    textColor: "#334155",
    font: "600 18px ui-sans-serif, system-ui, sans-serif",
  });

  fillRoundedRect(context, metricCardX, metricCardY, metricCardWidth, metricCardHeight, 28, "#0F172A");
  context.fillStyle = "#E2E8F0";
  context.font = "600 18px ui-sans-serif, system-ui, sans-serif";
  context.fillText(`Details ${detailPageIndex + 1} of ${detailPageCount}`, metricCardX + 28, metricCardY + 34);
  context.fillStyle = "#FFFFFF";
  context.font = "700 34px ui-sans-serif, system-ui, sans-serif";
  context.fillText(`${totalEntries} entries`, metricCardX + 28, metricCardY + 72);
  context.fillStyle = "#93C5FD";
  context.font = "600 18px ui-sans-serif, system-ui, sans-serif";
  context.fillText(`${formatHours(totalHours)} hours logged`, metricCardX + 28, metricCardY + 96);

  fillTopRoundedRect(context, tableX, tableY, tableWidth, tableHeaderHeight, 34, "#0F172A");

  let headerColumnX = tableX;
  context.font = "700 16px ui-sans-serif, system-ui, sans-serif";
  context.fillStyle = "#E2E8F0";
  context.textAlign = "left";
  context.textBaseline = "middle";
  DETAIL_TABLE_COLUMNS.forEach((column) => {
    context.fillText(column.label, headerColumnX + 12, tableY + tableHeaderHeight / 2);
    headerColumnX += column.width;
  });

  context.strokeStyle = "#D9E2EC";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(tableX, tableY + tableHeaderHeight);
  context.lineTo(tableX + tableWidth, tableY + tableHeaderHeight);
  context.stroke();

  let rowY = tableY + tableHeaderHeight;
  rows.forEach((row, rowIndex) => {
    context.fillStyle = rowIndex % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
    context.fillRect(tableX, rowY, tableWidth, row.rowHeight);

    let columnX = tableX;
    DETAIL_TABLE_COLUMNS.forEach((column) => {
      context.strokeStyle = "#D9E2EC";
      context.lineWidth = 1;
      context.strokeRect(columnX, rowY, column.width, row.rowHeight);

      const lines = row.cells[column.key];
      context.textAlign = "left";
      context.textBaseline = "top";
      context.font =
        column.key === "duration" || column.key === "code"
          ? "600 16px ui-sans-serif, system-ui, sans-serif"
          : "500 16px ui-sans-serif, system-ui, sans-serif";
      context.fillStyle = column.key === "notes" ? "#334155" : "#0F172A";
      lines.forEach((line, lineIndex) => {
        if (!line) {
          return;
        }
        context.fillText(line, columnX + 12, rowY + 12 + lineIndex * 20);
      });
      columnX += column.width;
    });

    rowY += row.rowHeight;
  });

  context.fillStyle = "#64748B";
  context.textAlign = "right";
  context.textBaseline = "alphabetic";
  context.font = "500 18px ui-sans-serif, system-ui, sans-serif";
  context.fillText(`Page ${pageIndex + 1} of ${pageCount}`, PAGE_PIXEL_WIDTH - PAGE_PADDING, PAGE_PIXEL_HEIGHT - 18);

  return canvas;
}

function createJpegBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to encode the calendar export."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.95,
    );
  });
}

function joinUint8Arrays(chunks: Uint8Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });

  return output;
}

function asciiBytes(value: string) {
  return new TextEncoder().encode(value);
}

function createPdfObject(objectNumber: number, parts: Uint8Array[]) {
  return joinUint8Arrays([asciiBytes(`${objectNumber} 0 obj\n`), ...parts, asciiBytes("\nendobj\n")]);
}

function createPdfStreamObject(objectNumber: number, dictionary: string, streamBytes: Uint8Array) {
  return createPdfObject(objectNumber, [
    asciiBytes(`<< ${dictionary}${dictionary ? " " : ""}/Length ${streamBytes.length} >>\nstream\n`),
    streamBytes,
    asciiBytes("\nendstream"),
  ]);
}

function buildPdfBlob(images: PdfImage[]) {
  const objects: Uint8Array[] = [];
  const pageObjectNumbers: number[] = [];
  const contentObjectNumbers: number[] = [];
  const imageObjectNumbers: number[] = [];
  let nextObjectNumber = 3;

  images.forEach(() => {
    pageObjectNumbers.push(nextObjectNumber++);
    contentObjectNumbers.push(nextObjectNumber++);
    imageObjectNumbers.push(nextObjectNumber++);
  });

  objects[1] = createPdfObject(1, [asciiBytes("<< /Type /Catalog /Pages 2 0 R >>")]);
  objects[2] = createPdfObject(
    2,
    [
      asciiBytes(
        `<< /Type /Pages /Count ${images.length} /Kids [${pageObjectNumbers.map((objectNumber) => `${objectNumber} 0 R`).join(" ")}] >>`,
      ),
    ],
  );

  images.forEach((image, index) => {
    const pageObjectNumber = pageObjectNumbers[index];
    const contentObjectNumber = contentObjectNumbers[index];
    const imageObjectNumber = imageObjectNumbers[index];
    const imageName = `/Im${index + 1}`;
    const contentStream = asciiBytes(
      `q\n${PDF_PAGE_WIDTH} 0 0 ${PDF_PAGE_HEIGHT} 0 0 cm\n${imageName} Do\nQ`,
    );

    objects[contentObjectNumber] = createPdfStreamObject(contentObjectNumber, "", contentStream);
    objects[imageObjectNumber] = createPdfStreamObject(
      imageObjectNumber,
      `/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,
      image.bytes,
    );
    objects[pageObjectNumber] = createPdfObject(
      pageObjectNumber,
      [
        asciiBytes(
          `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /ProcSet [/PDF /ImageC] /XObject << ${imageName} ${imageObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
        ),
      ],
    );
  });

  const pdfHeader = asciiBytes("%PDF-1.4\n");
  const outputChunks: Uint8Array[] = [pdfHeader];
  const offsets: number[] = [0];
  let currentOffset = pdfHeader.length;

  for (let objectNumber = 1; objectNumber < objects.length; objectNumber += 1) {
    const objectBytes = objects[objectNumber];
    if (!objectBytes) {
      continue;
    }

    offsets[objectNumber] = currentOffset;
    outputChunks.push(objectBytes);
    currentOffset += objectBytes.length;
  }

  const xrefOffset = currentOffset;
  const xrefEntries = [
    `xref\n0 ${objects.length}\n`,
    "0000000000 65535 f \n",
    ...Array.from({ length: objects.length - 1 }, (_, index) => {
      const objectNumber = index + 1;
      const offset = offsets[objectNumber] ?? 0;
      return `${offset.toString().padStart(10, "0")} 00000 n \n`;
    }),
  ];

  outputChunks.push(asciiBytes(xrefEntries.join("")));
  outputChunks.push(asciiBytes(`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));

  return new Blob([joinUint8Arrays(outputChunks)], { type: "application/pdf" });
}

export async function buildMonthlyCalendarPdf(options: MonthlyCalendarPdfOptions) {
  const weekPages = buildMonthPages(options.referenceDate, options.entries);
  const detailTableRows = buildDetailTableRows(options.entries);
  const detailPages = paginateDetailTableRows(detailTableRows);
  const totalPageCount = weekPages.length + detailPages.length;
  const images: PdfImage[] = [];

  for (const [pageIndex, page] of weekPages.entries()) {
    const canvas = renderWeeklyCalendarPage(page, options, pageIndex, totalPageCount);
    const blob = await createJpegBlob(canvas);
    images.push({
      bytes: new Uint8Array(await blob.arrayBuffer()),
      width: canvas.width,
      height: canvas.height,
    });
  }

  for (const [detailPageIndex, detailPageRows] of detailPages.entries()) {
    const canvas = renderDetailedWorklogPage(
      detailPageRows,
      options,
      detailPageIndex,
      detailPages.length,
      weekPages.length + detailPageIndex,
      totalPageCount,
    );
    const blob = await createJpegBlob(canvas);
    images.push({
      bytes: new Uint8Array(await blob.arrayBuffer()),
      width: canvas.width,
      height: canvas.height,
    });
  }

  return buildPdfBlob(images);
}
