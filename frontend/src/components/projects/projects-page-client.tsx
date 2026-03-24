"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { Project } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { deleteProject, listProjects, createProject, updateProject } from "@/services/projects";
import { ProjectDialog } from "@/components/projects/project-dialog";

export function ProjectsPageClient() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      code: string;
      name: string;
      description: string;
      color_hex: string;
      is_active: boolean;
    }) => {
      if (activeProject) {
        return updateProject(activeProject.id, payload);
      }
      return createProject(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project saved.");
      setDialogOpen(false);
      setActiveProject(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save the project.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!activeProject) {
        return;
      }
      return deleteProject(activeProject.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted.");
      setDialogOpen(false);
      setActiveProject(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to delete the project.");
    },
  });

  if (user?.role !== "admin") {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <h2 className="text-xl font-semibold text-slate-950">Admin access required</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Project management is reserved for admins. Regular users can still log time against active projects.
          </p>
        </CardContent>
      </Card>
    );
  }

  const projects = projectsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Projects"
        description="Control which projects are available in the work logging flow."
        actions={
          <Button
            onClick={() => {
              setActiveProject(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            New project
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.length > 0 ? (
                projects.map((project) => (
                  <TableRow
                    key={project.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setActiveProject(project);
                      setDialogOpen(true);
                    }}
                  >
                    <TableCell className="font-semibold text-slate-950">{project.name}</TableCell>
                    <TableCell>{project.code}</TableCell>
                    <TableCell>
                      <Badge variant={project.is_active ? "default" : "outline"}>
                        {project.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: project.color_hex }} />
                        {project.color_hex}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[420px] truncate text-muted-foreground">
                      {project.description || "No description"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    {projectsQuery.isLoading ? "Loading projects..." : "No projects yet. Create the first one to unlock logging."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ProjectDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setActiveProject(null);
          }
        }}
        project={activeProject}
        isSaving={saveMutation.isPending}
        isDeleting={deleteMutation.isPending}
        onSave={async (payload) => saveMutation.mutateAsync(payload)}
        onDelete={async () => deleteMutation.mutateAsync()}
      />
    </div>
  );
}

