import { WorkLogEntry } from "@/lib/types";
import { apiRequest } from "@/services/api";

export type WorkLogPayload = {
  user?: number;
  project: number;
  work_date: string;
  hour_slot: number;
  notes: string;
};

export type WorkLogRangePayload = {
  user?: number;
  project: number;
  work_date: string;
  hour_slots: number[];
  notes: string;
};

export function listWorkLogs(filters: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      return;
    }
    params.set(key, String(value));
  });
  const query = params.toString();
  return apiRequest<WorkLogEntry[]>(`worklogs/${query ? `?${query}` : ""}`);
}

export function createWorkLog(payload: WorkLogPayload) {
  return apiRequest<WorkLogEntry>("worklogs/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createWorkLogRange(payload: WorkLogRangePayload) {
  return apiRequest<WorkLogEntry[]>("worklogs/bulk-create/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateWorkLog(entryId: number, payload: Partial<WorkLogPayload>) {
  return apiRequest<WorkLogEntry>(`worklogs/${entryId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteWorkLog(entryId: number) {
  return apiRequest<void>(`worklogs/${entryId}/`, {
    method: "DELETE",
  });
}
