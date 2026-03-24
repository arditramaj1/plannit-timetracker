"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addWeeks, format, subWeeks } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { formatApiDate, getWeekDates, getWeekRangeLabel, getWeekStart, safeParseDate } from "@/lib/date";
import { Project, WorkLogEntry } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { WorklogDialog } from "@/components/calendar/worklog-dialog";
import { WeeklyCalendar } from "@/components/calendar/weekly-calendar";
import { listProjects } from "@/services/projects";
import { createWorkLog, deleteWorkLog, listWorkLogs, updateWorkLog } from "@/services/worklogs";

type DialogState = {
  day: Date;
  hourSlot: number;
  entry?: WorkLogEntry | null;
};

export function CalendarPageClient() {
  const queryClient = useQueryClient();
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [dialogState, setDialogState] = useState<DialogState | null>(null);

  const weekDates = useMemo(() => getWeekDates(anchorDate), [anchorDate]);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  });

  const worklogsQuery = useQuery({
    queryKey: ["worklogs", formatApiDate(weekStart), formatApiDate(weekEnd)],
    queryFn: () =>
      listWorkLogs({
        date_from: formatApiDate(weekStart),
        date_to: formatApiDate(weekEnd),
      }),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { project: number; notes: string }) => {
      if (!dialogState) {
        throw new Error("No calendar slot selected.");
      }
      if (dialogState.entry) {
        return updateWorkLog(dialogState.entry.id, {
          notes: payload.notes,
          ...(payload.project !== dialogState.entry.project ? { project: payload.project } : {}),
        });
      }
      return createWorkLog({
        project: payload.project,
        notes: payload.notes,
        work_date: formatApiDate(dialogState.day),
        hour_slot: dialogState.hourSlot,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["worklogs"] });
      toast.success("Work log saved.");
      setDialogState(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save the work log.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!dialogState?.entry) {
        return;
      }
      return deleteWorkLog(dialogState.entry.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["worklogs"] });
      toast.success("Work log deleted.");
      setDialogState(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to delete the work log.");
    },
  });

  function openNewEntry(day: Date, hourSlot: number) {
    setDialogState({ day, hourSlot });
  }

  function openExistingEntry(entry: WorkLogEntry) {
    setDialogState({
      day: safeParseDate(entry.work_date),
      hourSlot: entry.hour_slot,
      entry,
    });
  }

  const activeProjects = (projectsQuery.data ?? []).filter((project) => project.is_active);
  const worklogs = worklogsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Weekly Tracking"
        title="Calendar"
        description="Click any hourly slot to log what you worked on. Existing entries stay easy to scan and edit."
        actions={
          <>
            <Button variant="outline" onClick={() => setAnchorDate(getWeekStart(new Date()))}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => setAnchorDate((current) => subWeeks(current, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setAnchorDate((current) => addWeeks(current, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        <CardContent className="space-y-4 p-4 lg:p-6">
          <div className="flex flex-col gap-2 border-b border-border/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">{getWeekRangeLabel(anchorDate)}</h2>
              <p className="text-sm text-muted-foreground">
                Week of {format(weekStart, "MMMM d, yyyy")} to {format(weekEnd, "MMMM d, yyyy")}
              </p>
            </div>
            <div className="rounded-full bg-secondary px-4 py-2 text-sm text-secondary-foreground">
              {worklogs.length} logged {worklogs.length === 1 ? "hour" : "hours"} this week
            </div>
          </div>

          {projectsQuery.isLoading || worklogsQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-[920px] w-full rounded-3xl" />
            </div>
          ) : projectsQuery.isError || worklogsQuery.isError ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
              {projectsQuery.error instanceof Error
                ? projectsQuery.error.message
                : worklogsQuery.error instanceof Error
                  ? worklogsQuery.error.message
                  : "The calendar could not be loaded."}
            </div>
          ) : activeProjects.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/80 bg-muted/20 p-10 text-center">
              <h3 className="text-lg font-semibold text-slate-950">No active projects yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Ask an admin to create or reactivate a project before logging time.
              </p>
            </div>
          ) : (
            <WeeklyCalendar weekDates={weekDates} entries={worklogs} onSlotClick={openNewEntry} onEntryClick={openExistingEntry} />
          )}
        </CardContent>
      </Card>

      <WorklogDialog
        open={Boolean(dialogState)}
        onOpenChange={(open) => {
          if (!open) {
            setDialogState(null);
          }
        }}
        day={dialogState?.day ?? null}
        hourSlot={dialogState?.hourSlot ?? null}
        entry={dialogState?.entry ?? null}
        projects={activeProjects as Project[]}
        isSaving={saveMutation.isPending}
        isDeleting={deleteMutation.isPending}
        onSave={async (payload) => saveMutation.mutateAsync(payload)}
        onDelete={async () => deleteMutation.mutateAsync()}
      />
    </div>
  );
}
