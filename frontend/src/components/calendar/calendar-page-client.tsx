"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addWeeks, format, subWeeks } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { formatApiDate, getWeekDates, getWeekRangeLabel, getWeekStart, safeParseDate } from "@/lib/date";
import { Project, User as AppUser, WorkLogEntry } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { WorklogDialog, type WorklogSavePayload } from "@/components/calendar/worklog-dialog";
import { WeeklyCalendar } from "@/components/calendar/weekly-calendar";
import { listProjects } from "@/services/projects";
import { listUsers } from "@/services/users";
import {
  createParallelWorkLogs,
  createWorkLog,
  createWorkLogRange,
  deleteWorkLog,
  listWorkLogs,
  updateWorkLog,
} from "@/services/worklogs";

type DialogState = {
  day: Date;
  hourSlots: number[];
  entry?: WorkLogEntry | null;
  blockedProjectIds?: number[];
};

function getDefaultSelectedUserId(users: AppUser[], currentUserId?: number) {
  const firstOtherUser = users.find((candidate) => candidate.id !== currentUserId);
  return firstOtherUser?.id ?? null;
}

function buildHourSlots(startHour: number, endHour: number) {
  const firstHour = Math.min(startHour, endHour);
  const lastHour = Math.max(startHour, endHour);
  return Array.from({ length: lastHour - firstHour + 1 }, (_, index) => firstHour + index);
}

function getEntryHourSlots(entry: WorkLogEntry) {
  const durationHours = Math.max(1, entry.duration_minutes / 60);
  return buildHourSlots(entry.hour_slot, entry.hour_slot + durationHours - 1);
}

function getEntryEndHour(entry: WorkLogEntry) {
  return entry.hour_slot + Math.max(1, entry.duration_minutes / 60);
}

function getParallelWindowEntries(entries: WorkLogEntry[], targetEntry: WorkLogEntry) {
  return entries.filter(
    (entry) => entry.work_date === targetEntry.work_date && entry.hour_slot === targetEntry.hour_slot,
  );
}

function buildParallelEntryWindowMap(entries: WorkLogEntry[]) {
  const entriesByWindow = new Map<string, WorkLogEntry[]>();

  entries.forEach((entry) => {
    const key = `${entry.work_date}-${entry.hour_slot}`;
    const groupedEntries = entriesByWindow.get(key) ?? [];
    groupedEntries.push(entry);
    entriesByWindow.set(key, groupedEntries);
  });

  const parallelEntryWindowMap = new Map<number, number>();

  entriesByWindow.forEach((groupedEntries) => {
    if (groupedEntries.length < 2) {
      return;
    }

    const maxEndHour = Math.max(...groupedEntries.map((entry) => getEntryEndHour(entry)));
    groupedEntries.forEach((entry) => {
      parallelEntryWindowMap.set(entry.id, maxEndHour);
    });
  });

  return parallelEntryWindowMap;
}

function formatHourLabel(hour: number) {
  return `${hour.toString().padStart(2, "0")}:00`;
}

function formatHourTotal(totalHours: number) {
  return Number.isInteger(totalHours) ? String(totalHours) : totalHours.toFixed(1);
}

function getOverlappingEntries(
  entries: WorkLogEntry[],
  workDate: string,
  hourSlots: number[],
  ignoredEntryId?: number | null,
) {
  const startHour = hourSlots[0];
  const endHour = hourSlots[hourSlots.length - 1] + 1;

  return entries
    .filter((entry) => entry.work_date === workDate && entry.id !== ignoredEntryId)
    .filter((entry) => {
      const entryEndHour = entry.hour_slot + Math.max(1, entry.duration_minutes / 60);
      return startHour < entryEndHour && entry.hour_slot < endHour;
    })
    .sort((left, right) => left.hour_slot - right.hour_slot);
}

function sortWorkLogs(entries: WorkLogEntry[]) {
  return [...entries].sort(
    (left, right) =>
      left.work_date.localeCompare(right.work_date) || left.hour_slot - right.hour_slot || left.id - right.id,
  );
}

function upsertWorkLogEntry(entries: WorkLogEntry[], nextEntry: WorkLogEntry) {
  return sortWorkLogs([...entries.filter((entry) => entry.id !== nextEntry.id), nextEntry]);
}

export function CalendarPageClient() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [resizeEntry, setResizeEntry] = useState<WorkLogEntry | null>(null);

  const weekDates = useMemo(() => getWeekDates(anchorDate), [anchorDate]);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
    enabled: isAdmin,
  });

  const selectableUsers = useMemo(() => {
    const users = usersQuery.data ?? [];
    return isAdmin ? users.filter((candidate) => candidate.id !== user?.id) : [];
  }, [isAdmin, user?.id, usersQuery.data]);

  useEffect(() => {
    if (!isAdmin) {
      setSelectedUserId(null);
      return;
    }

    if (selectableUsers.length === 0) {
      setSelectedUserId(null);
      return;
    }

    setSelectedUserId((current) => {
      if (current && selectableUsers.some((candidate) => candidate.id === current)) {
        return current;
      }
      return getDefaultSelectedUserId(selectableUsers, user?.id);
    });
  }, [isAdmin, selectableUsers, user?.id]);

  useEffect(() => {
    if (isAdmin) {
      setDialogState(null);
      setResizeEntry(null);
    }
  }, [isAdmin, selectedUserId]);

  const selectedUser = isAdmin
    ? selectableUsers.find((candidate) => candidate.id === selectedUserId) ?? null
    : user;
  const canLogParallelProjects = Boolean(selectedUser?.can_log_parallel_projects);

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  });

  const worklogsQueryKey = [
    "worklogs",
    formatApiDate(weekStart),
    formatApiDate(weekEnd),
    isAdmin ? selectedUserId ?? "none" : "self",
  ] as const;

  const worklogsQuery = useQuery({
    queryKey: worklogsQueryKey,
    enabled: !isAdmin || Boolean(selectedUserId),
    queryFn: () =>
      listWorkLogs({
        date_from: formatApiDate(weekStart),
        date_to: formatApiDate(weekEnd),
        ...(isAdmin && selectedUserId ? { user: selectedUserId } : {}),
      }),
  });

  const activeProjects = (projectsQuery.data ?? []).filter((project) => project.is_active);
  const worklogs = useMemo(() => worklogsQuery.data ?? [], [worklogsQuery.data]);
  const parallelEntryWindowMap = useMemo(() => buildParallelEntryWindowMap(worklogs), [worklogs]);
  const dialogProjects = dialogState?.blockedProjectIds?.length
    ? activeProjects.filter((project) => !dialogState.blockedProjectIds?.includes(project.id))
    : activeProjects;

  function updateVisibleWorkLogs(updater: (entries: WorkLogEntry[]) => WorkLogEntry[]) {
    queryClient.setQueryData<WorkLogEntry[]>(worklogsQueryKey, (current) => updater(current ?? []));
  }

  const saveMutation = useMutation({
    mutationFn: async (payload: WorklogSavePayload) => {
      if (!dialogState) {
        throw new Error("No calendar slot selected.");
      }

      if (dialogState.entry) {
        const parallelEntryMaxEndHour = parallelEntryWindowMap.get(dialogState.entry.id);
        const nextEndHour =
          payload.mode === "single"
            ? (parallelEntryMaxEndHour !== undefined ? dialogState.entry.hour_slot : payload.hourSlot) +
              payload.durationMinutes / 60
            : null;
        if (
          parallelEntryMaxEndHour !== undefined &&
          payload.mode === "single" &&
          nextEndHour > parallelEntryMaxEndHour
        ) {
          throw new Error(
            `This parallel work log can only extend until ${formatHourLabel(parallelEntryMaxEndHour)}.`,
          );
        }

        return [
          await updateWorkLog(dialogState.entry.id, {
            notes: payload.mode === "single" ? payload.notes : dialogState.entry.notes,
            ...(payload.mode === "single" && payload.project !== dialogState.entry.project
              ? { project: payload.project }
              : {}),
            ...(payload.mode === "single" &&
              parallelEntryMaxEndHour === undefined &&
              payload.hourSlot !== dialogState.entry.hour_slot
              ? { hour_slot: payload.hourSlot }
              : {}),
            ...(payload.mode === "single" &&
              payload.durationMinutes !== dialogState.entry.duration_minutes
              ? { duration_minutes: payload.durationMinutes }
              : {}),
          }),
        ];
      }

      const workDate = formatApiDate(dialogState.day);

      if (payload.mode === "parallel") {
        if (payload.entries.length < 2) {
          throw new Error("Add at least two projects to save parallel work logs.");
        }

        return createParallelWorkLogs({
          ...(isAdmin && selectedUserId ? { user: selectedUserId } : {}),
          work_date: workDate,
          hour_slot: payload.hourSlot,
          entries: payload.entries.map((entry) => ({
            project: entry.project,
            notes: entry.notes,
            duration_minutes: entry.durationMinutes,
          })),
        });
      }

      const durationHours = payload.durationMinutes / 60;
      if (durationHours > 1) {
        return [
          await createWorkLogRange({
            ...(isAdmin && selectedUserId ? { user: selectedUserId } : {}),
            project: payload.project,
            notes: payload.notes,
            work_date: workDate,
            hour_slots: buildHourSlots(payload.hourSlot, payload.hourSlot + durationHours - 1),
          }),
        ];
      }

      if (isAdmin) {
        if (!selectedUserId) {
          throw new Error("Choose a user before saving a work log.");
        }
        return [
          await createWorkLog({
            user: selectedUserId,
            project: payload.project,
            notes: payload.notes,
            work_date: workDate,
            hour_slot: payload.hourSlot,
            duration_minutes: payload.durationMinutes,
          }),
        ];
      }

      return [
        await createWorkLog({
          project: payload.project,
          notes: payload.notes,
          work_date: workDate,
          hour_slot: payload.hourSlot,
          duration_minutes: payload.durationMinutes,
        }),
      ];
    },
    onSuccess: (savedEntries) => {
      updateVisibleWorkLogs((entries) => savedEntries.reduce(upsertWorkLogEntry, entries));
      void queryClient.invalidateQueries({ queryKey: ["worklogs"], refetchType: "inactive" });
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success(savedEntries.length > 1 ? "Parallel work logs saved." : "Work log saved.");
      setDialogState(null);
      setResizeEntry(null);
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
    onSuccess: () => {
      if (dialogState?.entry) {
        updateVisibleWorkLogs((entries) => entries.filter((entry) => entry.id !== dialogState.entry?.id));
      }
      void queryClient.invalidateQueries({ queryKey: ["worklogs"], refetchType: "inactive" });
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Work log deleted.");
      setDialogState(null);
      setResizeEntry(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to delete the work log.");
    },
  });

  const totalLoggedHours = worklogs.reduce((sum, entry) => sum + entry.duration_minutes, 0) / 60;
  const canSelectRanges = (!isAdmin || Boolean(selectedUser)) && (activeProjects.length > 0 || Boolean(resizeEntry));

  function openRangeSelection(day: Date, startHour: number, endHour: number) {
    const hourSlots = buildHourSlots(startHour, endHour);
    const workDate = formatApiDate(day);

    if (resizeEntry && resizeEntry.work_date !== workDate) {
      toast.error("Resize on calendar currently works within the same day only.");
      return;
    }

    const overlappingEntries = getOverlappingEntries(worklogs, workDate, hourSlots, resizeEntry?.id ?? null);
    if (overlappingEntries.length > 0 && (!canLogParallelProjects || Boolean(resizeEntry))) {
      const formattedRanges = overlappingEntries
        .map((entry) => `${formatHourLabel(entry.hour_slot)} to ${formatHourLabel(entry.hour_slot + entry.duration_minutes / 60)}`)
        .join(", "
        );
      toast.error(`This selection overlaps existing work logs: ${formattedRanges}.`);
      return;
    }

    if (resizeEntry) {
      setDialogState({ day, hourSlots, entry: resizeEntry });
      setResizeEntry(null);
      return;
    }

    setDialogState({ day, hourSlots });
  }

  function openExistingEntry(entry: WorkLogEntry) {
    setResizeEntry(null);
    setDialogState({
      day: safeParseDate(entry.work_date),
      hourSlots: getEntryHourSlots(entry),
      entry,
    });
  }

  const calendarDescription = resizeEntry
    ? "Resize mode is active. Drag a new range on the same day to change this work log's duration."
    : isAdmin
      ? selectedUser
        ? selectedUser.can_log_parallel_projects
          ? "Select a teammate, then create time windows that can be split across up to four overlapping project entries with separate notes."
          : "Select a teammate, then click or drag across empty hours to create one multi-hour work log with a shared note and project."
        : "Choose a teammate to view and manage their weekly calendar."
      : canLogParallelProjects
        ? "Click a slot or drag across empty hours to create work windows that can be split across up to four overlapping project entries."
        : "Click a slot or drag across empty hours to create one work log that can span multiple hourly blocks.";
  const hoursSummary = selectedUser
    ? `${selectedUser.display_name}: ${formatHourTotal(totalLoggedHours)} logged ${totalLoggedHours === 1 ? "hour" : "hours"}`
    : `${formatHourTotal(totalLoggedHours)} logged ${totalLoggedHours === 1 ? "hour" : "hours"}`;
  const isLoading = projectsQuery.isLoading || worklogsQuery.isLoading || (isAdmin && usersQuery.isLoading);
  const hasError = projectsQuery.isError || worklogsQuery.isError || (isAdmin && usersQuery.isError);
  const activeDialogEntry = dialogState?.entry ?? null;
  const activeDialogEntryParallelMaxEndHour = activeDialogEntry
    ? parallelEntryWindowMap.get(activeDialogEntry.id) ?? null
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isAdmin ? "Administration" : "Weekly Tracking"}
        title="Calendar"
        description={calendarDescription}
        actions={
          <>
            {isAdmin ? (
              <Select
                value={selectedUserId ? String(selectedUserId) : undefined}
                onValueChange={(value) => setSelectedUserId(Number(value))}
                disabled={usersQuery.isLoading || selectableUsers.length === 0}
              >
                <SelectTrigger className="w-[240px] bg-white">
                  <SelectValue placeholder={usersQuery.isLoading ? "Loading users..." : "Select a user"} />
                </SelectTrigger>
                <SelectContent>
                  {selectableUsers.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
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

      {resizeEntry ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-950">Resize mode is active</p>
            <p className="text-sm text-slate-700">
              Drag a new range on {format(safeParseDate(resizeEntry.work_date), "EEEE, MMM d")} to resize this work log.
            </p>
          </div>
          <Button variant="outline" onClick={() => setResizeEntry(null)}>
            Cancel resize
          </Button>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <CardContent className="space-y-4 p-4 lg:p-6">
          <div className="flex flex-col gap-2 border-b border-border/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">{getWeekRangeLabel(anchorDate)}</h2>
              <p className="text-sm text-muted-foreground">
                Week of {format(weekStart, "MMMM d, yyyy")} to {format(weekEnd, "MMMM d, yyyy")}
              </p>
              {isAdmin && selectedUser ? (
                <p className="mt-2 text-sm text-slate-700">Viewing {selectedUser.display_name}&apos;s calendar</p>
              ) : null}
            </div>
            <div className="rounded-full bg-secondary px-4 py-2 text-sm text-secondary-foreground">{hoursSummary}</div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-[920px] w-full rounded-3xl" />
            </div>
          ) : hasError ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
              {isAdmin && usersQuery.error instanceof Error
                ? usersQuery.error.message
                : projectsQuery.error instanceof Error
                  ? projectsQuery.error.message
                  : worklogsQuery.error instanceof Error
                    ? worklogsQuery.error.message
                    : "The calendar could not be loaded."}
            </div>
          ) : isAdmin && selectableUsers.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/80 bg-muted/20 p-10 text-center">
              <h3 className="text-lg font-semibold text-slate-950">No other users available yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Create or activate another account before managing work logs from the calendar.
              </p>
            </div>
          ) : isAdmin && !selectedUser ? (
            <div className="rounded-3xl border border-dashed border-border/80 bg-muted/20 p-10 text-center">
              <h3 className="text-lg font-semibold text-slate-950">Select a user to continue</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Choose a teammate from the selector above to view or edit their week.
              </p>
            </div>
          ) : activeProjects.length === 0 && worklogs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/80 bg-muted/20 p-10 text-center">
              <h3 className="text-lg font-semibold text-slate-950">No active projects yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {isAdmin
                  ? "Create or reactivate a project before adding team work logs here."
                  : "Ask an admin to create or reactivate a project before logging time."}
              </p>
            </div>
          ) : (
            <WeeklyCalendar
              weekDates={weekDates}
              entries={worklogs}
              onRangeSelect={openRangeSelection}
              onEntryClick={openExistingEntry}
              allowCreate={canSelectRanges}
              resizingEntryId={resizeEntry?.id ?? null}
            />
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
        hourSlots={dialogState?.hourSlots ?? []}
        entry={dialogState?.entry ?? null}
        projects={dialogProjects as Project[]}
        userLabel={isAdmin ? selectedUser?.display_name ?? null : null}
        canLogParallelProjects={canLogParallelProjects}
        isSaving={saveMutation.isPending}
        isDeleting={deleteMutation.isPending}
        onSave={async (payload) => {
          await saveMutation.mutateAsync(payload);
        }}
        onDelete={async () => {
          await deleteMutation.mutateAsync();
        }}
        onResizeWithCalendar={
          activeDialogEntry && activeDialogEntryParallelMaxEndHour === null
            ? () => {
                setResizeEntry(activeDialogEntry);
                setDialogState(null);
                toast("Drag a new range on the same day to resize this work log.");
              }
            : undefined
        }
        onAddParallelProjects={
          activeDialogEntry && canLogParallelProjects
            ? () => {
                const usedProjectIds = Array.from(
                  new Set(getParallelWindowEntries(worklogs, activeDialogEntry).map((entry) => entry.project)),
                );
                const remainingProjects = activeProjects.filter((project) => !usedProjectIds.includes(project.id));
                if (remainingProjects.length === 0) {
                  toast.error("All active projects are already part of this parallel work.");
                  return;
                }

                setResizeEntry(null);
                setDialogState({
                  day: safeParseDate(activeDialogEntry.work_date),
                  hourSlots: getEntryHourSlots(activeDialogEntry),
                  blockedProjectIds: usedProjectIds,
                });
              }
            : undefined
        }
        lockStartHour={Boolean(activeDialogEntryParallelMaxEndHour)}
        maxEndHour={activeDialogEntryParallelMaxEndHour}
      />
    </div>
  );
}
