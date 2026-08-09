import { useEffect, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Building2, Fingerprint, Clock, FileStack, Loader2 } from "lucide-react";
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
    <div className="surface-grid grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between p-12 lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
            <Building2 className="size-6 text-primary" />
          </span>
          <div>
            <p className="font-display text-xl font-semibold text-gradient">Billzo</p>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Office Management</p>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="font-display text-4xl font-semibold leading-tight">
            Agent management &amp; attendance, <span className="text-gradient">done properly</span>.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Complete agent profiles, secure document vault, and real-time attendance tracking — built to scale
            with every future Billzo module.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              { icon: Fingerprint, text: "Role-based access for Super Admin, Admin & Agent" },
              { icon: FileStack, text: "Encrypted document storage with instant preview" },
              { icon: Clock, text: "Clock in / out with automatic working-hour totals" },
            ].map((f, i) => (
              <li
                key={f.text}
                className="glass animate-rise flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <f.icon className="size-4 shrink-0 text-primary" />
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Billzo. All rights reserved.</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="glass animate-rise w-full max-w-md rounded-2xl p-7">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
              <Building2 className="size-5 text-primary" />
            </span>
            <p className="font-display text-lg font-semibold text-gradient">Billzo</p>
          </div>

          <h2 className="font-display text-2xl font-semibold">Sign in to your workspace</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The first account created becomes the Super Admin.
          </p>


          <Tabs defaultValue="signin" className="mt-6">
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
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null} Sign In
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
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null} Create Account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
}
