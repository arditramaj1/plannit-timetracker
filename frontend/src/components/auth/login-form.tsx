"use client";

import { LoaderCircle, LockKeyhole, User as UserIcon } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const { user, isInitialized, isLoading, login } = useAuth();
  const [username, setUsername] = useState("alex");
  const [password, setPassword] = useState("demo123");

  useEffect(() => {
    if (isInitialized && user) {
      router.replace("/calendar");
    }
  }, [isInitialized, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await login(username, password);
      toast.success("Signed in successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in.");
    }
  }

  return (
    <Card className="w-full max-w-md border-white/80 bg-white/95 backdrop-blur">
      <CardHeader className="space-y-3">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>
            Sign in to manage your weekly work logs. Demo accounts are prefilled for quick access.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <UserIcon className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="alex"
                className="pl-10"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="demo123"
            />
          </div>
          <Button className="w-full" type="submit" disabled={isLoading}>
            {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Sign In
          </Button>
          <div className="rounded-xl bg-secondary p-3 text-xs text-secondary-foreground">
            Demo user: <span className="font-semibold">alex / demo123</span>
            <br />
            Demo admin: <span className="font-semibold">admin / admin123</span>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
