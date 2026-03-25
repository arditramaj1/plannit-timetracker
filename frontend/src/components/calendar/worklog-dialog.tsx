"use client";

import { format } from "date-fns";
import { LoaderCircle, Trash2 } from "lucide-react";
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
  onSave: (payload: { project: number; notes: string }) => Promise<void>;
  onDelete: () => Promise<void>;
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
}: WorklogDialogProps) {
  const [project, setProject] = useState("");
  const [notes, setNotes] = useState("");
  const sortedHourSlots = useMemo(() => [...hourSlots].sort((left, right) => left - right), [hourSlots]);
  const projectOptions = useMemo(
    () =>
      entry && !projects.some((item) => item.id === entry.project)
        ? ([{ id: entry.project, name: `${entry.project_name} (archived)` } as Project, ...projects] satisfies Project[])
        : projects,
    [entry, projects],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setProject(entry ? String(entry.project) : projectOptions[0] ? String(projectOptions[0].id) : "");
    setNotes(entry?.notes ?? "");
  }, [entry, open, projectOptions]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project) {
      return;
    }
    await onSave({ project: Number(project), notes });
  }

  const isEditing = Boolean(entry);
  const slotCount = sortedHourSlots.length;
  const formattedSlot = useMemo(() => {
    if (!day || slotCount === 0) {
      return "";
    }
    const startHour = sortedHourSlots[0];
    if (slotCount === 1) {
      return `${format(day, "EEEE, MMM d")} at ${startHour.toString().padStart(2, "0")}:00`;
    }
    const endHour = sortedHourSlots[slotCount - 1] + 1;
    return `${format(day, "EEEE, MMM d")} from ${startHour.toString().padStart(2, "0")}:00 to ${endHour.toString().padStart(2, "0")}:00`;
  }, [day, slotCount, sortedHourSlots]);

  const selectionHint = !isEditing && slotCount > 1
    ? `This will create ${slotCount} one-hour work logs with the same project and notes.`
    : null;
  const dialogTitle = isEditing ? "Edit work log" : slotCount > 1 ? "Add work logs" : "Add work log";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            {formattedSlot || "Select a calendar slot to create a work log entry."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {userLabel ? (
            <div className="rounded-2xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
              Saving {slotCount > 1 && !isEditing ? "these work logs" : "this work log"} for{" "}
              <span className="font-semibold text-slate-950">{userLabel}</span>.
            </div>
          ) : null}

          {selectionHint ? (
            <div className="rounded-2xl border border-border/80 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              {selectionHint}
            </div>
          ) : null}

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
            <div>
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
              <Button type="submit" disabled={!project || isSaving || isDeleting}>
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
