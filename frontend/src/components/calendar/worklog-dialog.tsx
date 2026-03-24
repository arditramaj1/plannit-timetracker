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
  hourSlot: number | null;
  entry?: WorkLogEntry | null;
  projects: Project[];
  isSaving: boolean;
  isDeleting: boolean;
  onSave: (payload: { project: number; notes: string }) => Promise<void>;
  onDelete: () => Promise<void>;
};

export function WorklogDialog({
  open,
  onOpenChange,
  day,
  hourSlot,
  entry,
  projects,
  isSaving,
  isDeleting,
  onSave,
  onDelete,
}: WorklogDialogProps) {
  const [project, setProject] = useState("");
  const [notes, setNotes] = useState("");
  const projectOptions = useMemo(
    () =>
      entry && !projects.some((item) => item.id === entry.project)
        ? [{ id: entry.project, name: `${entry.project_name} (archived)` } as Project, ...projects]
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
  const formattedSlot =
    day && hourSlot !== null ? `${format(day, "EEEE, MMM d")} at ${hourSlot.toString().padStart(2, "0")}:00` : "";

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
              placeholder="What did you work on during this hour?"
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
