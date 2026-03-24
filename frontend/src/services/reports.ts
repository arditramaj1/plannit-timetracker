import { ReportFilters, ReportResponse } from "@/lib/types";
import { apiRequest, downloadAuthenticatedFile } from "@/services/api";

function buildQuery(filters: ReportFilters & { export?: "json" | "csv" }) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });
  return params.toString();
}

export function getReport(filters: ReportFilters) {
  const query = buildQuery({ export: "json", ...filters });
  return apiRequest<ReportResponse>(`reports/summary/?${query}`);
}

export async function exportReportCsv(filters: ReportFilters) {
  const query = buildQuery({ export: "csv", ...filters });
  const blob = await downloadAuthenticatedFile(`reports/summary/?${query}`);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "worklog-report.csv";
  link.click();
  window.URL.revokeObjectURL(url);
}

