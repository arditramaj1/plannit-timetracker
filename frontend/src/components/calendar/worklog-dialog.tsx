"use client";

import { format } from "date-fns";
import { ChevronLeft, ChevronRight, LoaderCircle, Maximize2, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Project, WorkLogEntry } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

function formatHourLabel(hour: number) {
  return `${hour.toString().padStart(2, "0")}:00`;
}

type ParallelEntryDraft = {
  id: number;
  slotNumber: number;
  project: string;
  notes: string;
  durationHours: number;
};

export type WorklogSavePayload =
  | {
      mode: "single";
      project: number;
      notes: string;
      hourSlot: number;
      durationMinutes: number;
    }
  | {
      mode: "parallel";
      hourSlot: number;
      entries: Array<{
        project: number;
        notes: string;
        durationMinutes: number;
      }>;
    };

type WorklogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: Date | null;
  hourSlots: number[];
  entry?: WorkLogEntry | null;
  projects: Project[];
  userLabel?: string | null;
  canLogParallelProjects?: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  onSave: (payload: WorklogSavePayload) => Promise<void>;
  onDelete: () => Promise<void>;
  onResizeWithCalendar?: () => void;
  onAddParallelProjects?: () => void;
  lockStartHour?: boolean;
  maxEndHour?: number | null;
};

let nextParallelDraftId = 1;

function createParallelEntryDraft(
  slotNumber: number,
  overrides: Partial<Omit<ParallelEntryDraft, "id" | "slotNumber">> = {},
): ParallelEntryDraft {
  const draft: ParallelEntryDraft = {
    id: nextParallelDraftId,
    slotNumber,
    project: "",
    notes: "",
    durationHours: 1,
    ...overrides,
  };
  nextParallelDraftId += 1;
  return draft;
}

export function WorklogDialog({
  open,
  onOpenChange,
  day,
  hourSlots,
  entry,
  projects,
  userLabel,
  canLogParallelProjects = false,
  isSaving,
  isDeleting,
  onSave,
  onDelete,
  onResizeWithCalendar,
  onAddParallelProjects,
  lockStartHour = false,
  maxEndHour = null,
}: WorklogDialogProps) {
  const [project, setProject] = useState("");
  const [notes, setNotes] = useState("");
  const [startHour, setStartHour] = useState(0);
  const [endHour, setEndHour] = useState(1);
  const [parallelEntries, setParallelEntries] = useState<ParallelEntryDraft[]>([]);
  const [activeParallelEntryId, setActiveParallelEntryId] = useState<number | null>(null);

  const isEditing = Boolean(entry);
  const parallelEditLimit = isEditing && maxEndHour !== null ? maxEndHour : null;
  const startHourLocked = isEditing && lockStartHour;
  const canCreateParallel = canLogParallelProjects && !isEditing;
  const sortedHourSlots = useMemo(() => [...hourSlots].sort((left, right) => left - right), [hourSlots]);
  const projectOptions = useMemo(
    () =>
      entry && !projects.some((item) => item.id === entry.project)
        ? ([{ id: entry.project, name: `${entry.project_name} (archived)` } as Project, ...projects] satisfies Project[])
        : projects,
    [entry, projects],
  );

  const initialStartHour = sortedHourSlots[0] ?? entry?.hour_slot ?? 0;
  const initialEndHour = (sortedHourSlots[sortedHourSlots.length - 1] ?? entry?.hour_slot ?? 0) + 1;
  const slotCount = endHour - startHour;

  function getNextAvailableParallelSlotNumber(entries: ParallelEntryDraft[]) {
    for (let slotNumber = 1; slotNumber <= 4; slotNumber += 1) {
      if (!entries.some((draft) => draft.slotNumber === slotNumber)) {
        return slotNumber;
      }
    }

    return entries.length + 1;
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    const initialDurationHours = Math.max(1, initialEndHour - initialStartHour);
    const initialDraft = createParallelEntryDraft(1, {
      durationHours: initialDurationHours,
    });
    setProject(entry ? String(entry.project) : projectOptions[0] ? String(projectOptions[0].id) : "");
    setNotes(entry?.notes ?? "");
    setStartHour(initialStartHour);
    setEndHour(initialEndHour);
    setParallelEntries([initialDraft]);
    setActiveParallelEntryId(initialDraft.id);
  }, [entry, initialEndHour, initialStartHour, open, projectOptions]);

  useEffect(() => {
    if (!open || !canCreateParallel || slotCount <= 0 || parallelEntries.length === 0) {
      return;
    }

    setParallelEntries((current) =>
      current.map((draft) => ({
        ...draft,
        durationHours: Math.min(Math.max(draft.durationHours, 1), slotCount),
      })),
    );
  }, [canCreateParallel, open, parallelEntries.length, slotCount]);

  useEffect(() => {
    if (parallelEntries.length === 0) {
      setActiveParallelEntryId(null);
      return;
    }

    if (activeParallelEntryId && parallelEntries.some((draft) => draft.id === activeParallelEntryId)) {
      return;
    }

    setActiveParallelEntryId(parallelEntries[0].id);
  }, [activeParallelEntryId, parallelEntries]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (slotCount <= 0) {
      return;
    }

    if (canCreateParallel) {
      const populatedEntries = parallelEntries.filter((draft) => draft.project);
      if (populatedEntries.length === 0) {
        return;
      }

      if (populatedEntries.length > 1) {
        await onSave({
          mode: "parallel",
          hourSlot: startHour,
          entries: populatedEntries.map((draft) => ({
            project: Number(draft.project),
            notes: draft.notes,
            durationMinutes: draft.durationHours * 60,
          })),
        });
        return;
      }

      const [singleDraft] = populatedEntries;
      await onSave({
        mode: "single",
        project: Number(singleDraft.project),
        notes: singleDraft.notes,
        hourSlot: startHour,
        durationMinutes: singleDraft.durationHours * 60,
      });
      return;
    }

    if (!project) {
      return;
    }

    await onSave({
      mode: "single",
      project: Number(project),
      notes,
      hourSlot: startHour,
      durationMinutes: slotCount * 60,
    });
  }

  const formattedSlot = useMemo(() => {
    if (!day || slotCount <= 0) {
      return "";
    }
    if (slotCount === 1) {
      return `${format(day, "EEEE, MMM d")} at ${formatHourLabel(startHour)}`;
    }
    return `${format(day, "EEEE, MMM d")} from ${formatHourLabel(startHour)} to ${formatHourLabel(endHour)}`;
  }, [day, endHour, slotCount, startHour]);

  const selectionHint = parallelEditLimit
    ? `This parallel work log keeps its original start time. You can update its project, notes, and end time up to ${formatHourLabel(parallelEditLimit)}.`
    : canCreateParallel
      ? slotCount > 1
        ? `This ${slotCount}-hour window can be split across up to four projects. Each project keeps its own notes and duration.`
        : "This user can log parallel project work here. Add one or more project allocations with separate notes."
      : slotCount > 1
        ? isEditing
          ? `This work log spans ${slotCount} hourly blocks as one shared entry.`
          : `This will create one work log spanning ${slotCount} hourly blocks with one shared note and project.`
        : null;

  const canAddMoreProjects = canCreateParallel && parallelEntries.length < Math.min(4, projectOptions.length);
  const hasValidParallelEntries =
    !canCreateParallel ||
    (parallelEntries.length > 0 &&
      parallelEntries.every(
        (draft) =>
          Boolean(draft.project) &&
          draft.durationHours >= 1 &&
          draft.durationHours <= slotCount,
      ));
  const activeParallelEntryIndex = parallelEntries.findIndex((draft) => draft.id === activeParallelEntryId);
  const activeParallelEntry =
    activeParallelEntryIndex >= 0 ? parallelEntries[activeParallelEntryIndex] : parallelEntries[0] ?? null;

  function updateParallelEntry(draftId: number, nextValues: Partial<Omit<ParallelEntryDraft, "id">>) {
    setParallelEntries((current) =>
      current.map((draft) => (draft.id === draftId ? { ...draft, ...nextValues } : draft)),
    );
  }

  function handleAddParallelEntry() {
    setParallelEntries((current) => [
      ...current,
      createParallelEntryDraft(getNextAvailableParallelSlotNumber(current), {
        durationHours: Math.max(1, slotCount),
      }),
    ]);
  }

  function getParallelEntryLabel(draft: ParallelEntryDraft) {
    const selectedProject = projectOptions.find((item) => String(item.id) === draft.project);
    return selectedProject?.name ?? `Project ${draft.slotNumber}`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit work log" : "Add work log"}</DialogTitle>
          <DialogDescription>
            {formattedSlot || "Select a calendar slot to create a work log entry."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {userLabel ? (
            <div className="rounded-2xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
              Saving this work log for <span className="font-semibold text-slate-950">{userLabel}</span>.
            </div>
          ) : null}

          {selectionHint ? (
            <div className="rounded-2xl border border-border/80 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              {selectionHint}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start-hour">Start</Label>
              <Select
                value={String(startHour)}
                disabled={startHourLocked}
                onValueChange={(value) => {
                  const nextStartHour = Number(value);
                  setStartHour(nextStartHour);
                  setEndHour((current) => (current <= nextStartHour ? nextStartHour + 1 : current));
                }}
              >
                <SelectTrigger id="start-hour" disabled={startHourLocked}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, hour) => (
                    <SelectItem key={hour} value={String(hour)}>
                      {formatHourLabel(hour)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-hour">End</Label>
              <Select
                value={String(endHour)}
                onValueChange={(value) => setEndHour(Number(value))}
              >
                <SelectTrigger id="end-hour">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(
                    { length: (parallelEditLimit ?? 24) - startHour },
                    (_, offset) => startHour + offset + 1,
                  ).map((hour) => (
                    <SelectItem key={hour} value={String(hour)}>
                      {formatHourLabel(hour)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {canCreateParallel ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-muted/10 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <Label>Project allocations</Label>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Choose up to four projects. Each selection creates its own overlapping work log entry.
                    </p>
                  </div>
                  {canAddMoreProjects ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddParallelEntry}
                    >
                      <Plus className="h-4 w-4" />
                      Add project
                    </Button>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                  {parallelEntries.map((draft, index) => {
                    const selectedProject = projectOptions.find((item) => String(item.id) === draft.project);
                    const isActive = draft.id === activeParallelEntry?.id;

                    return (
                      <button
                        key={draft.id}
                        type="button"
                        onClick={() => setActiveParallelEntryId(draft.id)}
                        className={`flex w-full min-w-0 max-w-[220px] items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-colors xl:max-w-full ${
                          isActive
                            ? "border-slate-950 bg-slate-950 text-white"
                            : "border-border bg-white text-slate-700 hover:bg-muted"
                        }`}
                      >
                        <span
                          className="h-3 w-3 shrink-0 rounded-full border border-white/80 shadow-sm"
                          style={{ backgroundColor: selectedProject?.color_hex ?? "#CBD5E1" }}
                        />
                        <div className="min-w-0 overflow-hidden">
                          <p className="truncate text-sm font-semibold">{getParallelEntryLabel(draft)}</p>
                          <p className={`text-xs ${isActive ? "text-white/70" : "text-muted-foreground"}`}>
                            {draft.durationHours}h allocation
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/80 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {activeParallelEntryIndex + 1} of {parallelEntries.length}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      One project card is visible at a time so the dialog stays compact.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setActiveParallelEntryId(
                          parallelEntries[Math.max(0, activeParallelEntryIndex - 1)]?.id ?? null,
                        )
                      }
                      disabled={activeParallelEntryIndex <= 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setActiveParallelEntryId(
                          parallelEntries[Math.min(parallelEntries.length - 1, activeParallelEntryIndex + 1)]?.id ??
                            null,
                        )
                      }
                      disabled={activeParallelEntryIndex >= parallelEntries.length - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {activeParallelEntry ? (() => {
                const selectedProject = projectOptions.find((item) => String(item.id) === activeParallelEntry.project);
                const selectedProjectIds = new Set(
                  parallelEntries
                    .filter((item) => item.id !== activeParallelEntry.id)
                    .map((item) => item.project)
                    .filter(Boolean),
                );
                const availableProjects = projectOptions.filter(
                  (item) =>
                    String(item.id) === activeParallelEntry.project ||
                    !selectedProjectIds.has(String(item.id)),
                );

                return (
                  <div className="rounded-[28px] border border-border/80 bg-white p-5 shadow-surface">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span
                            className="h-3 w-3 rounded-full border border-white/80 shadow-sm"
                            style={{ backgroundColor: selectedProject?.color_hex ?? "#CBD5E1" }}
                          />
                          <p className="text-sm font-semibold text-slate-950">
                            {getParallelEntryLabel(activeParallelEntry)}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Adjust this project&apos;s duration and notes without making the whole dialog taller.
                        </p>
                      </div>
                      {parallelEntries.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setParallelEntries((current) =>
                              current.filter((item) => item.id !== activeParallelEntry.id),
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </Button>
                      ) : null}
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
                      <div className="space-y-2">
                        <Label>Project</Label>
                        <Select
                          value={activeParallelEntry.project}
                          onValueChange={(value) => updateParallelEntry(activeParallelEntry.id, { project: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a project" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableProjects.map((item) => (
                              <SelectItem key={item.id} value={String(item.id)}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Duration</Label>
                        <Select
                          value={String(activeParallelEntry.durationHours)}
                          onValueChange={(value) =>
                            updateParallelEntry(activeParallelEntry.id, { durationHours: Number(value) })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: slotCount }, (_, offset) => offset + 1).map((hours) => (
                              <SelectItem key={hours} value={String(hours)}>
                                {hours}h
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="mt-5 space-y-2">
                      <Label>Project notes</Label>
                      <Textarea
                        value={activeParallelEntry.notes}
                        onChange={(event) =>
                          updateParallelEntry(activeParallelEntry.id, { notes: event.target.value })
                        }
                        placeholder="What did you work on for this project during the selected window?"
                      />
                    </div>
                  </div>
                );
              })() : null}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="project">Project</Label>
                <Select value={project} onValueChange={setProject}>
                  <SelectTrigger id="project">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectOptions.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="What did you work on during this time block?"
                />
              </div>
            </>
          )}

          <DialogFooter className="justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {isEditing && onAddParallelProjects ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onAddParallelProjects}
                  disabled={isSaving || isDeleting}
                >
                  <Plus className="h-4 w-4" />
                  Add parallel projects
                </Button>
              ) : null}
              {isEditing && onResizeWithCalendar ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onResizeWithCalendar}
                  disabled={isSaving || isDeleting}
                >
                  <Maximize2 className="h-4 w-4" />
                  Resize on calendar
                </Button>
              ) : null}
              {isEditing ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void onDelete()}
                  disabled={isDeleting || isSaving}
                >
                  {isDeleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete
                </Button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  slotCount <= 0 ||
                  isSaving ||
                  isDeleting ||
                  (canCreateParallel ? !hasValidParallelEntries : !project)
                }
              >
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
