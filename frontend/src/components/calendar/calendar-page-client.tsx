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
import { WorklogDialog } from "@/components/calendar/worklog-dialog";
import { WeeklyCalendar } from "@/components/calendar/weekly-calendar";
import { listProjects } from "@/services/projects";
import { listUsers } from "@/services/users";
import { createWorkLog, createWorkLogRange, deleteWorkLog, listWorkLogs, updateWorkLog } from "@/services/worklogs";

type DialogState = {
  day: Date;
  hourSlots: number[];
  entry?: WorkLogEntry | null;
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

export function CalendarPageClient() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

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
    }
  }, [isAdmin, selectedUserId]);

  const selectedUser = isAdmin
    ? selectableUsers.find((candidate) => candidate.id === selectedUserId) ?? null
    : user;

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  });

  const worklogsQuery = useQuery({
    queryKey: ["worklogs", formatApiDate(weekStart), formatApiDate(weekEnd), isAdmin ? selectedUserId ?? "none" : "self"],
    enabled: !isAdmin || Boolean(selectedUserId),
    queryFn: () =>
      listWorkLogs({
        date_from: formatApiDate(weekStart),
        date_to: formatApiDate(weekEnd),
        ...(isAdmin && selectedUserId ? { user: selectedUserId } : {}),
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

      const workDate = formatApiDate(dialogState.day);
      if (dialogState.hourSlots.length > 1) {
        return createWorkLogRange({
          ...(isAdmin && selectedUserId ? { user: selectedUserId } : {}),
          project: payload.project,
          notes: payload.notes,
          work_date: workDate,
          hour_slots: dialogState.hourSlots,
        });
      }

      const [hourSlot] = dialogState.hourSlots;
      if (isAdmin) {
        if (!selectedUserId) {
          throw new Error("Choose a user before saving a work log.");
        }
        return createWorkLog({
          user: selectedUserId,
          project: payload.project,
          notes: payload.notes,
          work_date: workDate,
          hour_slot: hourSlot,
        });
      }

      return createWorkLog({
        project: payload.project,
        notes: payload.notes,
        work_date: workDate,
        hour_slot: hourSlot,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["worklogs"] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
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
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Work log deleted.");
      setDialogState(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to delete the work log.");
    },
  });

  const activeProjects = (projectsQuery.data ?? []).filter((project) => project.is_active);
  const worklogs = worklogsQuery.data ?? [];
  const canCreateEntries = activeProjects.length > 0 && (!isAdmin || Boolean(selectedUser));

  function openRangeSelection(day: Date, startHour: number, endHour: number) {
    const hourSlots = buildHourSlots(startHour, endHour);
    const workDate = formatApiDate(day);
    const occupiedHours = worklogs
      .filter((entry) => entry.work_date === workDate && hourSlots.includes(entry.hour_slot))
      .map((entry) => entry.hour_slot)
      .sort((left, right) => left - right);

    if (occupiedHours.length > 0) {
      const formattedHours = occupiedHours.map((hour) => `${hour.toString().padStart(2, "0")}:00`).join(", ");
      toast.error(`Some selected hours already have work logs: ${formattedHours}.`);
      return;
    }

    setDialogState({ day, hourSlots });
  }

  function openExistingEntry(entry: WorkLogEntry) {
    setDialogState({
      day: safeParseDate(entry.work_date),
      hourSlots: [entry.hour_slot],
      entry,
    });
  }

  const calendarDescription = isAdmin
    ? selectedUser
      ? "Select a teammate, then click or drag down across empty hours to add a shared note and project for the whole block."
      : "Choose a teammate to view and manage their weekly calendar."
    : "Click a slot or drag down across empty hours to add one project and note across a longer time block.";
  const hoursSummary = selectedUser
    ? `${selectedUser.display_name}: ${worklogs.length} logged ${worklogs.length === 1 ? "hour" : "hours"}`
    : `${worklogs.length} logged ${worklogs.length === 1 ? "hour" : "hours"}`;
  const isLoading = projectsQuery.isLoading || worklogsQuery.isLoading || (isAdmin && usersQuery.isLoading);
  const hasError = projectsQuery.isError || worklogsQuery.isError || (isAdmin && usersQuery.isError);

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
              allowCreate={canCreateEntries}
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
        projects={activeProjects as Project[]}
        userLabel={isAdmin ? selectedUser?.display_name ?? null : null}
        isSaving={saveMutation.isPending}
        isDeleting={deleteMutation.isPending}
        onSave={async (payload) => {
          await saveMutation.mutateAsync(payload);
        }}
        onDelete={async () => {
          await deleteMutation.mutateAsync();
        }}
      />
    </div>
  );
}
