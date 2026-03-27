import { Copyright } from "lucide-react";
import Image from "next/image";

import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col px-4 py-10">
      <div className="flex flex-1 items-center justify-center">
        <div className="grid w-full max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-6">
            <Image
              src="/plannit-logo.svg"
              alt="Plannit Time Tracker"
              width={240}
              height={56}
              className="ml-[-20px] h-14 w-auto object-contain brightness-0 invert"
              priority
            />
            <div className="space-y-4">
              <h1 className="max-w-xl text-5xl font-semibold leading-tight text-slate-950 text-white">
                A smarter way to log your workweek built for clarity and not complexity.
              </h1>
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
      <p className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-white/70">
        <Copyright className="h-4 w-4" />
        <span>{currentYear} Devant Solutions</span>
      </p>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-3 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-surface backdrop-blur">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
