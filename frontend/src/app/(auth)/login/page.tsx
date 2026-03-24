import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Plannit Time Tracker</p>
          <div className="space-y-4">
            <h1 className="max-w-xl text-5xl font-semibold leading-tight text-slate-950">
              Weekly time logging that feels closer to a calendar than a stopwatch.
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Teams log work in clear one-hour calendar slots, admins get instant visibility, and reports stay export-friendly.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FeatureCard title="Manual work blocks" description="Track work in hourly calendar slots with project context and notes." />
            <FeatureCard title="Admin visibility" description="Filter across users, projects, and date ranges without leaving the app." />
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-surface backdrop-blur">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

