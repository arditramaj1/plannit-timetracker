"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, CalendarDays, FolderKanban, LoaderCircle, LogOut } from "lucide-react";
import { type ReactNode, useEffect } from "react";

import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navigation = [
  {
    href: "/calendar",
    label: "Calendar",
    icon: CalendarDays,
    adminOnly: false,
  },
  {
    href: "/projects",
    label: "Projects",
    icon: FolderKanban,
    adminOnly: true,
  },
  {
    href: "/reports",
    label: "Reports",
    icon: BarChart3,
    adminOnly: true,
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isInitialized, logout } = useAuth();

  useEffect(() => {
    if (isInitialized && !user) {
      router.replace("/login");
    }
  }, [isInitialized, router, user]);

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="inline-flex items-center gap-3 rounded-full border border-border bg-white px-5 py-3 text-sm text-muted-foreground shadow-surface">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading your workspace
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const visibleNavigation = navigation.filter((item) => !item.adminOnly || user.role === "admin");

  return (
    <div className="min-h-screen bg-background bg-hero-grid">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-6 px-4 py-4 lg:flex-row lg:px-6">
        <aside className="w-full shrink-0 rounded-[28px] border border-white/70 bg-white/95 p-5 shadow-surface backdrop-blur lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-[280px]">
          <div className="space-y-8">
            <div className="space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Plannit</p>
                <h1 className="text-2xl font-semibold text-slate-950">Time Tracker</h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Manual weekly work logging with a clean calendar flow and admin reporting.
              </p>
            </div>

            <nav className="grid gap-2">
              {visibleNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-slate-950 text-white"
                        : "text-slate-700 hover:bg-muted hover:text-slate-950",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="rounded-2xl bg-secondary p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Signed in as</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{user.display_name}</p>
              <p className="text-sm text-muted-foreground">{user.email || user.username}</p>
              <p className="mt-2 inline-flex rounded-full bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                {user.role}
              </p>
            </div>

            <Button variant="outline" className="w-full justify-start rounded-2xl" onClick={logout}>
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </aside>

        <main className="flex-1 rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-surface backdrop-blur lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
