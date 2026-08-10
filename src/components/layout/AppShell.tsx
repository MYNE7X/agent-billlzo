import { useState, type ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  ShieldCheck,
  UserCircle,
  LogOut,
  Building2,
  UserCog,
  Zap,
  Receipt,
  Wifi,
  BarChart3,
  ChevronRight,
  Home,
  Search,
  Command,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { initials, labelize } from "@/lib/billzo";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  shortLabel?: string;
  icon: typeof Users;
  staffOnly?: boolean;
  superOnly?: boolean;
};

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard },
  { to: "/attendance", label: "Attendance", shortLabel: "Punch", icon: CalendarCheck, staffOnly: true },
  { to: "/reports", label: "Reports", shortLabel: "Reports", icon: BarChart3 },
  { to: "/agents", label: "Agents", shortLabel: "Agents", icon: Users, staffOnly: true },
  { to: "/expenses", label: "Expenses", shortLabel: "Expenses", icon: Receipt, staffOnly: true },
  { to: "/pending-approvals", label: "Pending", shortLabel: "Pending", icon: UserCog, staffOnly: true },
  { to: "/network-settings", label: "Network", shortLabel: "Network", icon: Wifi, staffOnly: true },
  { to: "/admins", label: "Admins", shortLabel: "Admins", icon: ShieldCheck, superOnly: true },
  { to: "/my-profile", label: "Profile", shortLabel: "Me", icon: UserCircle },
];

// ── desktop sidebar (single source of truth) ───────────────────────────────

function SidebarNav({
  items,
  primaryRole,
  profile,
  onNavigate,
  onSignOut,
}: {
  items: NavItem[];
  primaryRole: "super_admin" | "admin" | "agent";
  profile: { full_name: string | null; email: string | null; avatar_url: string | null } | null;
  onNavigate?: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      {/* Brand — animated aurora mark */}
      <Link
        to="/dashboard"
        onClick={onNavigate}
        className="group relative flex items-center gap-3 overflow-hidden rounded-2xl px-2 py-2 transition-colors hover:bg-secondary/40"
      >
        <span className="relative grid size-11 place-items-center overflow-hidden rounded-xl">
          {/* gradient base */}
          <span className="absolute inset-0 bg-gradient-to-br from-primary via-cyan-400 to-fuchsia-500 opacity-95" />
          {/* shimmer overlay */}
          <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          {/* animated aurora glow */}
          <span className="absolute -inset-2 animate-aurora bg-gradient-to-br from-primary/40 via-fuchsia-500/40 to-violet-500/40 blur-lg" />
          <Building2 className="relative size-5 text-background drop-shadow" strokeWidth={2.4} />
          <span className="absolute inset-0 ring-1 ring-inset ring-white/25" />
        </span>
        <span className="min-w-0">
          <span className="brand-mark font-display block text-xl font-bold leading-tight">
            Billzo
          </span>
          <span className="block text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/70">
            Office System
          </span>
        </span>
      </Link>

      {/* Search hint (desktop only, decorative) */}
      <button
        className="hidden items-center gap-2 rounded-xl border border-border/60 bg-secondary/30 px-3 py-2 text-xs text-muted-foreground/70 transition-colors hover:border-primary/30 hover:bg-secondary/50 lg:flex"
        type="button"
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left">Quick search…</span>
        <kbd className="flex items-center gap-0.5 rounded-md border border-border/70 bg-background/60 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          <Command className="size-2.5" />K
        </kbd>
      </button>

      {/* Primary nav */}
      <nav className="no-scrollbar no-scrollbar-webkit -mx-1 flex-1 overflow-y-auto px-1 py-2">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/45">
          Menu
        </p>
        <div className="space-y-1">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              activeProps={{ className: "is-active" }}
              className={cn(
                "group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
              )}
            >
              {/* active gradient wash background */}
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-primary/15 via-primary/5 to-transparent transition-transform duration-300 [.is-active_&]:translate-x-0" />
              {/* active indicator bar (left) */}
              <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-primary to-fuchsia-500 opacity-0 transition-opacity duration-200 [.is-active_&]:opacity-100" />
              <span className="relative grid size-8 shrink-0 place-items-center rounded-lg bg-secondary/40 text-muted-foreground transition-all duration-200 group-hover:bg-primary/15 group-hover:text-primary [.is-active_&]:bg-primary/20 [.is-active_&]:text-primary [.is-active_&]:shadow-pop-primary">
                <item.icon className="size-4" strokeWidth={2.2} />
              </span>
              <span className="relative flex-1 [.is-active_&]:text-foreground [.is-active_&]:font-semibold">{item.label}</span>
              <ChevronRight className="relative size-3.5 text-muted-foreground/30 transition-all duration-200 [.is-active_&]:translate-x-0.5 [.is-active_&]:text-primary/70" />
            </Link>
          ))}
        </div>
      </nav>

      {/* Creator signature */}
      <CreatorBadge />

      {/* Account card */}
      <div className="aurora-border relative overflow-hidden rounded-2xl border border-border/50 bg-secondary/30 p-3">
        <span className="aurora-border-ring" />
        <div className="relative flex items-center gap-3">
          <Avatar className="size-9 ring-2 ring-primary/30 ring-offset-1 ring-offset-background">
            <AvatarFallback className="bg-gradient-to-br from-primary/30 to-fuchsia-500/20 text-xs font-bold text-primary">
              {initials(profile?.full_name ?? profile?.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{profile?.full_name ?? "User"}</p>
            <p className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
              {labelize(primaryRole)}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="relative mt-2 w-full justify-start text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          onClick={onSignOut}
        >
          <LogOut className="size-3.5" /> Sign out
        </Button>
      </div>
    </div>
  );
}

/** Compact creator signature — refined aurora card */
function CreatorBadge() {
  return (
    <div className="aurora-border relative overflow-hidden rounded-xl">
      <span className="aurora-border-ring" />
      <div className="relative px-3 py-2.5">
        {/* top gradient line */}
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, oklch(0.78 0.16 184 / 0.7) 35%, oklch(0.7 0.22 350 / 0.7) 65%, transparent 100%)",
          }}
        />
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <div
              className="absolute inset-0 animate-glow rounded-lg opacity-70 blur-md"
              style={{ background: "linear-gradient(135deg, oklch(0.78 0.16 184), oklch(0.7 0.22 350))" }}
            />
            <div
              className="relative grid size-8 place-items-center rounded-lg"
              style={{
                background: "linear-gradient(135deg, oklch(0.78 0.16 184 / 0.95), oklch(0.7 0.22 350 / 0.95))",
              }}
            >
              <Zap className="size-3.5 fill-background text-background" strokeWidth={2.5} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/60">
              Crafted by
            </p>
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-sm font-bold leading-tight"
                style={{
                  background: "linear-gradient(90deg, oklch(0.82 0.16 184) 0%, oklch(0.7 0.22 350) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Aziz
              </span>
              <span className="font-mono text-[10px] font-semibold text-muted-foreground/50">
                · Myne7x
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── main shell ─────────────────────────────────────────────────────────────

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, roles, isSuperAdmin, isStaff, signOut } = useAuth();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  const items = NAV.filter((i) => (!i.staffOnly || isStaff) && (!i.superOnly || isSuperAdmin));
  const primaryRole: "super_admin" | "admin" | "agent" = roles.includes("super_admin")
    ? "super_admin"
    : roles.includes("admin")
      ? "admin"
      : "agent";

  // ── MOBILE BOTTOM NAV — exactly 4 fixed slots, no "More" button ────────
  // Slot 1: Home (always)
  // Slot 2: Reports (always — available to all roles)
  // Slot 3: Attendance (staff) OR Profile (agent)
  // Slot 4: Me (Profile) — always last
  //
  // Everything else is reachable via the hamburger menu (top-left).
  // This guarantees consistent 4-slot layout on every phone, no overlap.
  const dashboardItem = items.find((i) => i.to === "/dashboard")!;
  const reportsItem = items.find((i) => i.to === "/reports");
  const attendanceItem = items.find((i) => i.to === "/attendance");
  const profileItem = items.find((i) => i.to === "/my-profile")!;

  const mobileSlots: NavItem[] = [
    dashboardItem,
    ...(reportsItem ? [reportsItem] : []),
    ...(attendanceItem ? [attendanceItem] : []),
    profileItem,
  ].filter(Boolean) as NavItem[];

  const handleSignOut = async () => {
    setSheetOpen(false);
    await signOut();
    void router.navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ── desktop sidebar (≥ lg) ───────────────────────────────────────── */}
      <aside className="glass fixed inset-y-0 left-0 z-40 hidden w-[280px] border-r border-border/40 lg:block">
        {/* Subtle vertical aurora wash on the sidebar */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-px opacity-50"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, oklch(0.78 0.16 184 / 0.5) 20%, oklch(0.7 0.22 350 / 0.5) 70%, transparent 100%)",
          }}
        />
        <SidebarNav
          items={items}
          primaryRole={primaryRole}
          profile={profile}
          onSignOut={handleSignOut}
        />
      </aside>

      {/* ── mobile top bar (fixed) ───────────────────────────────────────── */}
      <header
        className="glass safe-top fixed inset-x-0 top-0 z-30 border-b border-border/40 lg:hidden"
        style={{ paddingBottom: "8px" }}
      >
        <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
          {/* Hamburger — opens sheet with ALL nav items */}
          <button
            onClick={() => setSheetOpen(true)}
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary/40 text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground active:scale-95"
            aria-label="Open menu"
          >
            <svg viewBox="0 0 24 24" fill="none" className="size-4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
            <span className="relative grid size-7 shrink-0 place-items-center overflow-hidden rounded-lg">
              <span className="absolute inset-0 bg-gradient-to-br from-primary via-cyan-400 to-fuchsia-500 opacity-95" />
              <Building2 className="relative size-3.5 text-background" strokeWidth={2.5} />
            </span>
            <span className="brand-mark font-display text-base font-bold">Billzo</span>
          </Link>

          <div className="flex-1" />

          {/* Role pill — hidden on very narrow screens (≤400px) to avoid overflow */}
          <span className="hidden rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary min-[400px]:inline-block">
            {labelize(primaryRole)}
          </span>

          {/* Avatar shortcut */}
          <Link
            to="/my-profile"
            className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full ring-2 ring-primary/30 ring-offset-1 ring-offset-background active:scale-95"
          >
            <Avatar className="size-full">
              <AvatarFallback className="bg-gradient-to-br from-primary/30 to-fuchsia-500/20 text-[10px] font-bold text-primary">
                {initials(profile?.full_name ?? profile?.email)}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </header>

      {/* ── mobile sheet menu (the full nav drawer) ─────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-[300px] max-w-[85vw] border-border/40 bg-sidebar/95 p-0">
          <SheetHeader className="px-4 pt-4">
            <SheetTitle className="text-left text-base font-semibold">Menu</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100%-3rem)]">
            <SidebarNav
              items={items}
              primaryRole={primaryRole}
              profile={profile}
              onNavigate={() => setSheetOpen(false)}
              onSignOut={handleSignOut}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* ── desktop top bar (sticky, inside main column) ────────────────── */}
      <div className="lg:pl-[280px]">
        <header className="glass sticky top-0 z-30 hidden items-center gap-3 border-b border-border/40 px-8 py-3.5 lg:flex">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Home className="size-3.5" />
            <span className="font-medium">Billzo</span>
            <ChevronRight className="size-3 text-muted-foreground/40" />
            <span className="font-semibold text-foreground">{labelize(primaryRole)} workspace</span>
          </div>
          <div className="flex-1" />
          {/* Live status pill */}
          <div className="flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1.5">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-status-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            <span className="text-xs font-semibold text-success">Live</span>
          </div>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {labelize(primaryRole)}
          </span>
        </header>

        {/* ── main content area ────────────────────────────────────────────
         * Mobile:  pt-16 (top header 56px + safe area)
         *          pb-28 (bottom nav 64px + safe area + breathing room)
         * Desktop: pt-0 (sticky header is in-flow) + pb-10
         */}
        <main
          className="surface-grid relative min-h-screen px-3 pb-28 pt-16 sm:px-5 lg:px-8 lg:pb-10 lg:pt-6"
        >
          {/* Aurora ambient blobs — fixed within main column */}
          <div
            className="pointer-events-none absolute -top-32 right-0 -z-10 h-96 w-96 rounded-full opacity-30 blur-3xl"
            style={{ background: "radial-gradient(circle, oklch(0.7 0.22 350 / 0.5), transparent 70%)" }}
          />
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      {/* ── mobile bottom tab bar — fixed 4 slots, no overlap ──────────────
       * Each slot uses flex-1 with min-w-0 to guarantee equal widths and
       * prevent overflow on narrow phones (≤ 320px).
       */}
      <nav
        className="glass safe-bottom shadow-bar fixed inset-x-0 bottom-0 z-40 border-t border-border/40 lg:hidden"
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around gap-1 px-2 pb-1 pt-2">
          {mobileSlots.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeProps={{ className: "is-active" }}
              className="group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1 text-muted-foreground transition-colors active:scale-95"
            >
              {/* active top pill — gradient */}
              <span className="absolute -top-2 h-0.5 w-8 rounded-full bg-gradient-to-r from-primary to-fuchsia-500 opacity-0 transition-opacity duration-200 [.is-active_&]:opacity-100" />
              <span className="grid size-9 place-items-center rounded-xl bg-transparent transition-all duration-200 group-hover:bg-secondary/40 [.is-active_&]:bg-primary/15 [.is-active_&]:text-primary [.is-active_&]:shadow-pop-primary">
                <item.icon
                  className="size-5 transition-transform duration-200 group-active:scale-90 [.is-active_&]:scale-110"
                  strokeWidth={2.2}
                />
              </span>
              <span className="max-w-full truncate text-[10px] font-semibold leading-none tracking-wide [.is-active_&]:text-primary">
                {item.shortLabel ?? item.label}
              </span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
