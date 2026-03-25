"use client";

import { format } from "date-fns";
import { LoaderCircle, Maximize2, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Project, WorkLogEntry } from "@/lib/types";
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

type WorklogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: Date | null;
  hourSlots: number[];
  entry?: WorkLogEntry | null;
  projects: Project[];
  userLabel?: string | null;
  isSaving: boolean;
  isDeleting: boolean;
  onSave: (payload: { project: number; notes: string; hourSlot: number; durationMinutes: number }) => Promise<void>;
  onDelete: () => Promise<void>;
  onResizeWithCalendar?: () => void;
};

export function WorklogDialog({
  open,
  onOpenChange,
  day,
  hourSlots,
  entry,
  projects,
  userLabel,
  isSaving,
  isDeleting,
  onSave,
  onDelete,
  onResizeWithCalendar,
}: WorklogDialogProps) {
  const [project, setProject] = useState("");
  const [notes, setNotes] = useState("");
  const [startHour, setStartHour] = useState(0);
  const [endHour, setEndHour] = useState(1);

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

  useEffect(() => {
    if (!open) {
      return;
    }
    setProject(entry ? String(entry.project) : projectOptions[0] ? String(projectOptions[0].id) : "");
    setNotes(entry?.notes ?? "");
    setStartHour(initialStartHour);
    setEndHour(initialEndHour);
  }, [entry, initialEndHour, initialStartHour, open, projectOptions]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project || endHour <= startHour) {
      return;
    }
    await onSave({
      project: Number(project),
      notes,
      hourSlot: startHour,
      durationMinutes: (endHour - startHour) * 60,
    });
  }

  const isEditing = Boolean(entry);
  const slotCount = endHour - startHour;
  const formattedSlot = useMemo(() => {
    if (!day || slotCount <= 0) {
      return "";
    }
    if (slotCount === 1) {
      return `${format(day, "EEEE, MMM d")} at ${formatHourLabel(startHour)}`;
    }
    return `${format(day, "EEEE, MMM d")} from ${formatHourLabel(startHour)} to ${formatHourLabel(endHour)}`;
  }, [day, endHour, slotCount, startHour]);

  const selectionHint = slotCount > 1
    ? isEditing
      ? `This work log spans ${slotCount} hourly blocks as one shared entry.`
      : `This will create one work log spanning ${slotCount} hourly blocks with one shared note and project.`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit work log" : "Add work log"}</DialogTitle>
          <DialogDescription>
            {formattedSlot || "Select a calendar slot to create a work log entry."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {userLabel ? (
            <div className="rounded-2xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
              Saving this {slotCount}-hour work log for <span className="font-semibold text-slate-950">{userLabel}</span>.
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
                onValueChange={(value) => {
                  const nextStartHour = Number(value);
                  setStartHour(nextStartHour);
                  setEndHour((current) => (current <= nextStartHour ? nextStartHour + 1 : current));
                }}
              >
                <SelectTrigger id="start-hour">
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
              <Select value={String(endHour)} onValueChange={(value) => setEndHour(Number(value))}>
                <SelectTrigger id="end-hour">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 - startHour }, (_, offset) => startHour + offset + 1).map((hour) => (
                    <SelectItem key={hour} value={String(hour)}>
                      {formatHourLabel(hour)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

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

          <DialogFooter className="justify-between">
            <div className="flex items-center gap-2">
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
              <Button type="submit" disabled={!project || slotCount <= 0 || isSaving || isDeleting}>
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
