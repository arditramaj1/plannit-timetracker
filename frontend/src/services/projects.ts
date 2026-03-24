import { Project } from "@/lib/types";
import { apiRequest } from "@/services/api";

export function listProjects() {
  return apiRequest<Project[]>("projects/");
}

export function createProject(payload: Partial<Project>) {
  return apiRequest<Project>("projects/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateProject(projectId: number, payload: Partial<Project>) {
  return apiRequest<Project>(`projects/${projectId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteProject(projectId: number) {
  return apiRequest<void>(`projects/${projectId}/`, {
    method: "DELETE",
  });
}

