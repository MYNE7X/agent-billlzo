import { useEffect, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Fingerprint, Clock, FileStack, Loader2, ShieldCheck, Zap, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/")({
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (!loading && session) void router.navigate({ to: "/dashboard" });
  }, [loading, session, router]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back to Billzo");
    void router.navigate({ to: "/dashboard" });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created. You can sign in now.");
  };

  return (
    <div className="surface-grid relative grid min-h-screen lg:grid-cols-2">
      {/* ── Animated aurora background blobs ──────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -left-32 -top-32 h-[44rem] w-[44rem] animate-aurora rounded-full opacity-55 blur-[110px]"
          style={{ background: "radial-gradient(circle, oklch(0.78 0.16 184 / 0.65), transparent 70%)" }}
        />
        <div
          className="absolute -right-32 top-1/4 h-[42rem] w-[42rem] animate-aurora rounded-full opacity-50 blur-[110px]"
          style={{
            background: "radial-gradient(circle, oklch(0.7 0.22 350 / 0.65), transparent 70%)",
            animationDelay: "-6s",
          }}
        />
        <div
          className="absolute bottom-0 left-1/3 h-[36rem] w-[36rem] animate-aurora rounded-full opacity-45 blur-[110px]"
          style={{
            background: "radial-gradient(circle, oklch(0.66 0.2 295 / 0.55), transparent 70%)",
            animationDelay: "-12s",
          }}
        />
        <div
          className="absolute right-1/4 top-1/2 h-[28rem] w-[28rem] animate-aurora rounded-full opacity-35 blur-[100px]"
          style={{
            background: "radial-gradient(circle, oklch(0.74 0.16 156 / 0.45), transparent 70%)",
            animationDelay: "-3s",
          }}
        />
      </div>

      {/* ── Left brand panel ──────────────────────────────────────────────── */}
      <section className="relative hidden flex-col justify-between p-12 lg:flex">
        <div className="flex items-center gap-3">
          <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl">
            <img
              src="/logo.png"
              alt="Billzo"
              className="size-full object-cover"
              draggable={false}
            />
            <span className="pointer-events-none absolute -inset-3 animate-aurora bg-gradient-to-br from-primary/40 via-fuchsia-500/40 to-violet-500/40 blur-lg" />
          </span>
          <div>
            <p className="brand-mark font-display text-2xl font-bold">Billzo</p>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Office Management</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-status-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
            </span>
            Aurora Edition
          </div>

          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight">
            Agent management, <br />
            <span className="text-gradient-aurora">done properly.</span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            Complete agent profiles, secure document vault, and real-time attendance tracking —
            built to scale with every future Billzo module.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              { icon: Fingerprint, text: "Role-based access for Super Admin, Admin & Agent" },
              { icon: FileStack,    text: "Encrypted document storage with instant preview" },
              { icon: Clock,        text: "Clock in / out with automatic working-hour totals" },
              { icon: ShieldCheck,  text: "Office-network lock for attendance integrity" },
            ].map((f, i) => (
              <li
                key={f.text}
                className="aurora-border glass animate-rise flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <span className="aurora-border-ring" />
                <span className="relative grid size-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                  <f.icon className="size-3.5" strokeWidth={2.2} />
                </span>
                <span className="relative">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Billzo. All rights reserved.</p>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/60">
            <Zap className="size-3 fill-primary text-primary" />
            Crafted by Aziz · Myne7x
          </div>
        </div>
      </section>

      {/* ── Right auth panel ──────────────────────────────────────────────── */}
      <section className="relative flex items-center justify-center p-4 sm:p-6">
        <div className="aurora-border glass animate-rise relative w-full max-w-md rounded-3xl p-6 sm:p-8">
          <span className="aurora-border-ring" />
          {/* Mobile brand */}
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl">
              <img
                src="/logo-mark.png"
                alt="Billzo"
                className="size-full object-cover"
                draggable={false}
              />
            </span>
            <div>
              <p className="brand-mark font-display text-xl font-bold">Billzo</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Office Management</p>
            </div>
          </div>

          <h2 className="font-display relative text-2xl font-bold tracking-tight sm:text-3xl">Sign in to your workspace</h2>
          <p className="relative mt-1.5 text-sm text-muted-foreground">
            The first account created becomes the Super Admin.
          </p>

          <Tabs defaultValue="signin" className="relative mt-5 sm:mt-6">
            <TabsList className="grid w-full grid-cols-2 bg-secondary/60">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Create Account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@billzo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <Button
                  type="submit"
                  className="btn-shine group relative w-full bg-gradient-to-r from-primary via-cyan-400 to-primary bg-[length:200%_auto] text-primary-foreground transition-[background-position] duration-500 hover:bg-[position:right_center]"
                  disabled={busy}
                >
                  <span className="relative flex items-center justify-center gap-2">
                    {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                    Sign In
                    {!busy ? <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /> : null}
                  </span>
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-[12px] text-amber-300/90 space-y-1">
                <p className="font-semibold text-amber-300">⚠ Account pending approval</p>
                <p>Self-registered accounts must be approved by a Super Admin or Admin before accessing the system. Contact your administrator after signing up.</p>
              </div>
              <form onSubmit={signUp} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ahmed Raza"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email2">Email</Label>
                  <Input
                    id="email2"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@billzo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password2">Password</Label>
                  <Input
                    id="password2"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                  />
                </div>
                <Button
                  type="submit"
                  className="btn-shine group relative w-full bg-gradient-to-r from-primary via-cyan-400 to-primary bg-[length:200%_auto] text-primary-foreground transition-[background-position] duration-500 hover:bg-[position:right_center]"
                  disabled={busy}
                >
                  <span className="relative flex items-center justify-center gap-2">
                    {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                    Create Account
                    {!busy ? <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /> : null}
                  </span>
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
}
