"use client";

import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { formatApiDate } from "@/lib/date";
import { ReportFilters } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { listProjects } from "@/services/projects";
import { exportReportCsv, getReport } from "@/services/reports";
import { listUsers } from "@/services/users";

function formatHourValue(hours: number) {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2);
}

function formatTimeLabel(hour: number) {
  return `${hour.toString().padStart(2, "0")}:00`;
}

function formatTimeRange(hourSlot: number, durationMinutes: number) {
  const endHour = hourSlot + Math.max(1, durationMinutes / 60);
  return `${formatTimeLabel(hourSlot)} - ${formatTimeLabel(endHour)}`;
}

export function ReportsPageClient() {
  const { user } = useAuth();
  const today = formatApiDate(new Date());
  const [filters, setFilters] = useState<ReportFilters>({
    period: "week",
    reference_date: today,
    group_by: "week",
  });

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
    enabled: user?.role === "admin",
  });

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
    enabled: user?.role === "admin",
  });

  const reportQuery = useQuery({
    queryKey: ["reports", filters],
    queryFn: () => getReport(filters),
    enabled: user?.role === "admin",
  });

  if (user?.role !== "admin") {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <h2 className="text-xl font-semibold text-slate-950">Admin access required</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Reports aggregate work logged across the whole team, so they are only available to admins.
          </p>
        </CardContent>
      </Card>
    );
  }

  const report = reportQuery.data;

  async function handleExport() {
    try {
      await exportReportCsv(filters);
      toast.success("CSV export started.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export the report.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Reports"
        description="Analyze logged hours by user, project, and date range. Filters are already wired for CSV export."
        actions={
          <Button variant="outline" onClick={() => void handleExport()}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      <Card>
        <CardContent className="grid gap-4 p-6 lg:grid-cols-6">
          <div className="space-y-2 lg:col-span-1">
            <Label>Period</Label>
            <Select
              value={filters.period ?? "week"}
              onValueChange={(value) => setFilters((current) => ({ ...current, period: value as ReportFilters["period"] }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filters.period === "custom" ? (
            <>
              <div className="space-y-2 lg:col-span-1">
                <Label htmlFor="date_from">From</Label>
                <Input
                  id="date_from"
                  type="date"
                  value={filters.date_from ?? today}
                  onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))}
                />
              </div>
              <div className="space-y-2 lg:col-span-1">
                <Label htmlFor="date_to">To</Label>
                <Input
                  id="date_to"
                  type="date"
                  value={filters.date_to ?? today}
                  onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value }))}
                />
              </div>
            </>
          ) : (
            <div className="space-y-2 lg:col-span-1">
              <Label htmlFor="reference_date">Reference date</Label>
              <Input
                id="reference_date"
                type="date"
                value={filters.reference_date ?? today}
                onChange={(event) => setFilters((current) => ({ ...current, reference_date: event.target.value }))}
              />
            </div>
          )}

          <div className="space-y-2 lg:col-span-1">
            <Label>User</Label>
            <Select
              value={filters.user ? String(filters.user) : "all"}
              onValueChange={(value) =>
                setFilters((current) => ({ ...current, user: value === "all" ? undefined : Number(value) }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {(usersQuery.data ?? []).map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 lg:col-span-1">
            <Label>Project</Label>
            <Select
              value={filters.project ? String(filters.project) : "all"}
              onValueChange={(value) =>
                setFilters((current) => ({ ...current, project: value === "all" ? undefined : Number(value) }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {(projectsQuery.data ?? []).map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 lg:col-span-1">
            <Label>Group by</Label>
            <Select
              value={filters.group_by ?? "week"}
              onValueChange={(value) =>
                setFilters((current) => ({ ...current, group_by: value as ReportFilters["group_by"] }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Total Hours" value={formatHourValue(report?.summary.total_hours ?? 0)} />
        <SummaryCard title="Entries" value={String(report?.summary.total_entries ?? 0)} />
        <SummaryCard title="Users" value={String(report?.summary.unique_users ?? 0)} />
        <SummaryCard title="Projects" value={String(report?.summary.unique_projects ?? 0)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hours by user</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Total hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(report?.summary.by_user ?? []).length > 0 ? (
                  report?.summary.by_user.map((row) => (
                    <TableRow key={String(row.user_id)}>
                      <TableCell>
                        {[row.user__first_name, row.user__last_name].filter(Boolean).join(" ") || String(row.user__username)}
                      </TableCell>
                      <TableCell>{formatHourValue(Number(row.total_hours ?? 0))}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="py-8 text-center text-muted-foreground">
                      {reportQuery.isLoading ? "Loading summary..." : "No data for the selected filters."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hours by project</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Total hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(report?.summary.by_project ?? []).length > 0 ? (
                  report?.summary.by_project.map((row) => (
                    <TableRow key={String(row.project_id)}>
                      <TableCell>{String(row.project__name)}</TableCell>
                      <TableCell>{formatHourValue(Number(row.total_hours ?? 0))}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="py-8 text-center text-muted-foreground">
                      {reportQuery.isLoading ? "Loading summary..." : "No data for the selected filters."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detailed work logs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time Range</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(report?.details ?? []).length > 0 ? (
                report?.details.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.user.display_name}</TableCell>
                    <TableCell>{row.project.name}</TableCell>
                    <TableCell>{row.work_date}</TableCell>
                    <TableCell>{formatTimeRange(row.hour_slot, row.duration_minutes)}</TableCell>
                    <TableCell>{formatHourValue(row.duration_minutes / 60)}h</TableCell>
                    <TableCell className="max-w-[420px] truncate text-muted-foreground">
                      {row.notes || "No notes"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    {reportQuery.isLoading ? "Loading report..." : "No work logs matched the current filters."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="space-y-2 p-6">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-3xl font-semibold text-slate-950">{value}</p>
      </CardContent>
    </Card>
  );
}
