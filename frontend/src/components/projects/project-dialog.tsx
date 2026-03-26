"use client";

import { Check, ChevronDown, LoaderCircle, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

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
import { getSaturatedPastelProjectColors } from "@/lib/project-colors";
import { cn } from "@/lib/utils";

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
  const paletteColors = useMemo(() => getSaturatedPastelProjectColors(), []);
  const colorMenuRef = useRef<HTMLDivElement | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(paletteColors[0]);
  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const legacyColor = project?.color_hex?.toUpperCase();
  const hasLegacyColor = Boolean(legacyColor && !paletteColors.includes(legacyColor));
  const colorOptions = hasLegacyColor && legacyColor ? [legacyColor, ...paletteColors] : paletteColors;
  const isLegacySelection = Boolean(hasLegacyColor && color === legacyColor);

  useEffect(() => {
    if (!open) {
      return;
    }

    const currentProjectColor = project?.color_hex?.toUpperCase();
    setCode(project?.code ?? "");
    setName(project?.name ?? "");
    setDescription(project?.description ?? "");
    setColor(currentProjectColor ?? paletteColors[0]);
    setIsColorMenuOpen(false);
    setIsActive(project?.is_active ?? true);
  }, [open, paletteColors, project]);

  useEffect(() => {
    if (!isColorMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!colorMenuRef.current?.contains(event.target as Node)) {
        setIsColorMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsColorMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isColorMenuOpen]);

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
              <div className="relative" ref={colorMenuRef}>
                <button
                  id="color"
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={isColorMenuOpen}
                  onClick={() => setIsColorMenuOpen((current) => !current)}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-2 text-left shadow-sm ring-offset-background transition focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-5 w-5 shrink-0 rounded-full border border-slate-300 shadow-inner"
                      style={{ backgroundColor: color }}
                    />
                    <div className="truncate text-sm font-medium text-slate-950">
                      {isLegacySelection ? "Legacy project color" : "Choose a color"}
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      isColorMenuOpen ? "rotate-180" : "",
                    )}
                  />
                </button>

                {isColorMenuOpen ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-2xl border border-border bg-white p-3 shadow-surface">
                    <div className="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Choose a color
                    </div>
                    <div className="grid grid-cols-6 gap-2 px-1 pb-1" role="listbox" aria-label="Project colors">
                      {colorOptions.map((option) => {
                        const isSelected = option === color;

                        return (
                          <button
                            key={option}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            aria-label={
                              hasLegacyColor && option === legacyColor
                                ? "Select current legacy color"
                                : `Select color ${option}`
                            }
                            title={hasLegacyColor && option === legacyColor ? "Current legacy color" : option}
                            onClick={() => {
                              setColor(option);
                              setIsColorMenuOpen(false);
                            }}
                            className={cn(
                              "relative h-7 w-7 rounded-full border-2 shadow-sm transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring",
                              isSelected ? "border-slate-950 ring-2 ring-slate-950/15" : "border-white/80",
                            )}
                            style={{ backgroundColor: option }}
                          >
                            {isSelected ? <Check className="absolute inset-0 m-auto h-3 w-3 text-slate-950" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
              {hasLegacyColor ? (
                <p className="text-xs text-muted-foreground">
                  This project is using a legacy color. Pick one of the generated pastel colors to replace it.
                </p>
              ) : null}
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
