import { Link } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { History, Home, Radio, Settings } from "lucide-react";
import { applyTheme, loadSettings } from "@/lib/store";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative grid h-8 w-8 place-items-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
        <span className="font-display text-sm font-bold text-primary">ع</span>
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary" />
      </div>
      <span className="font-display text-[15px] font-semibold tracking-tight">A'wn Khafi</span>
    </div>
  );
}

const nav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/session", label: "Live Session", icon: Radio },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  useEffect(() => applyTheme(loadSettings().theme), []);
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 md:flex">
        <Logo className="px-2" />
        <nav className="mt-8 flex flex-col gap-0.5">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-foreground"
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          ))}
        </nav>
        <p className="mt-auto px-2 text-[11px] leading-relaxed text-muted-foreground">
          Use only where AI assistance is permitted.
        </p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <Logo />
          <nav className="flex gap-1">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className="rounded-md p-2 text-muted-foreground data-[status=active]:text-primary" activeOptions={{ exact: n.to === "/" }}>
                <n.icon className="h-4 w-4" />
              </Link>
            ))}
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
