"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import { Project } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
  isSaving: boolean;
  isDeleting: boolean;
  onSave: (payload: {
    code: string;
    name: string;
    description: string;
    color_hex: string;
    is_active: boolean;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
};

export function ProjectDialog({
  open,
  onOpenChange,
  project,
  isSaving,
  isDeleting,
  onSave,
  onDelete,
}: ProjectDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#0F766E");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) {
      return;
    }
    setCode(project?.code ?? "");
    setName(project?.name ?? "");
    setDescription(project?.description ?? "");
    setColor(project?.color_hex ?? "#0F766E");
    setIsActive(project?.is_active ?? true);
  }, [open, project]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim(),
      color_hex: color,
      is_active: isActive,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "Create project"}</DialogTitle>
          <DialogDescription>
            Admins can manage which projects are available when users log their work.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input id="code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="ENG" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Input id="color" type="color" value={color} onChange={(event) => setColor(event.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Platform Engineering" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What kind of work belongs to this project?"
            />
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-border/80 bg-muted/20 px-4 py-3">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
            <div>
              <p className="text-sm font-semibold text-slate-950">Active project</p>
              <p className="text-xs text-muted-foreground">Inactive projects stay in reports but cannot be selected for new logs.</p>
            </div>
          </label>

          <DialogFooter className="justify-between">
            <div>
              {project ? (
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
              <Button type="submit" disabled={!code || !name || isSaving || isDeleting}>
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Save project
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
