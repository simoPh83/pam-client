"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "password" | "magic" | "forgot";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const next = searchParams.get("next") ?? "/";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();

    if (mode === "password") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setLoading(false);
      if (error) {
        setError(error.message);
      } else {
        router.push(next);
        router.refresh();
      }
      return;
    }

    if (mode === "magic") {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      setLoading(false);
      if (error) setError(error.message);
      else setMessage(`Check ${email} for a sign-in link.`);
      return;
    }

    // forgot password
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
    });
    setLoading(false);
    if (error) setError(error.message);
    else setMessage(`If ${email} has an account, a reset link is on its way.`);
  }

  const titles: Record<Mode, string> = {
    password: "Sign in",
    magic: "Sign in with a magic link",
    forgot: "Reset your password",
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">PAM</h1>
          <p className="text-sm text-muted-foreground">
            Planning Application Monitor — {titles[mode].toLowerCase()}.
          </p>
        </div>

        {message ? (
          <div className="space-y-4">
            <p className="rounded-md border p-4 text-sm">{message}</p>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setMode("password");
                setMessage(null);
              }}
            >
              Back to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            {mode === "password" && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              {loading
                ? "One moment…"
                : mode === "password"
                  ? "Sign in"
                  : mode === "magic"
                    ? "Send magic link"
                    : "Send reset link"}
            </Button>

            <div className="flex justify-between text-xs text-muted-foreground">
              {mode !== "password" ? (
                <button type="button" className="hover:underline" onClick={() => setMode("password")}>
                  Use password
                </button>
              ) : (
                <button type="button" className="hover:underline" onClick={() => setMode("magic")}>
                  Use magic link instead
                </button>
              )}
              {mode !== "forgot" && (
                <button type="button" className="hover:underline" onClick={() => setMode("forgot")}>
                  Forgot password?
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
