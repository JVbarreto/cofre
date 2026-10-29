"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { LayoutDashboard, ArrowLeftRight, Landmark, ChartColumn, CalendarClock, LogOut } from "lucide-react";

const ICON_PROPS = { size: 18, strokeWidth: 1.75, "aria-hidden": true } as const;
const MOBILE_ICON_PROPS = { size: 20, strokeWidth: 1.8, "aria-hidden": true } as const;

const navItems = [
  { href: "/dashboard",      icon: <LayoutDashboard {...ICON_PROPS} />, mobileIcon: <LayoutDashboard {...MOBILE_ICON_PROPS} />, label: "Painel",       shortLabel: "Painel" },
  { href: "/lancamentos",    icon: <ArrowLeftRight {...ICON_PROPS} />,  mobileIcon: <ArrowLeftRight {...MOBILE_ICON_PROPS} />,  label: "Lançamentos",  shortLabel: "Lançamentos" },
  { href: "/contas-a-pagar", icon: <CalendarClock {...ICON_PROPS} />,   mobileIcon: <CalendarClock {...MOBILE_ICON_PROPS} />,   label: "Contas a Pagar", shortLabel: "Contas" },
  { href: "/investimentos",  icon: <Landmark {...ICON_PROPS} />,        mobileIcon: <Landmark {...MOBILE_ICON_PROPS} />,        label: "Investimentos", shortLabel: "Invest." },
  { href: "/relatorios",     icon: <ChartColumn {...ICON_PROPS} />,     mobileIcon: <ChartColumn {...MOBILE_ICON_PROPS} />,     label: "Relatórios",   shortLabel: "Relatórios" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const displayName =
    (user?.user_metadata?.name as string | undefined) || user?.email?.split("@")[0] || "";

  return (
    <>
      {/* 1. Header Fixo no Mobile */}
      <header className="mobile-header" aria-label="Cabeçalho móvel">
        <Link href="/dashboard" className="brand" style={{ margin: 0, padding: 0 }}>
          Cofre
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {user && (
            <span
              className="user-badge-mobile"
              title={user.email}
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-text-2)",
                maxWidth: 120,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                background: "var(--color-surface-2)",
                padding: "3px 8px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border)",
              }}
            >
              {displayName}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="btn btn-ghost"
            style={{ minHeight: 44, minWidth: 44, padding: 0, borderRadius: "var(--radius-sm)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            title="Sair da conta"
            aria-label="Sair da conta"
          >
            <LogOut size={18} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      {/* 2. Barra Lateral no Desktop */}
      <aside className="sidebar">
        <div className="brand">Cofre</div>

        <nav className="nav" aria-label="Principal">
          {navItems.map(item => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user">
            {user ? (
              <>
                <div className="user-name">{displayName}</div>
                <div className="user-email">{user.email}</div>
              </>
            ) : (
              <div className="skeleton" style={{ height: 32 }} aria-hidden="true" />
            )}
          </div>
          <button onClick={handleLogout} className="nav-item">
            <LogOut {...ICON_PROPS} />
            Sair
          </button>
        </div>
      </aside>

      {/* 3. Bottom Navigation Bar no Mobile */}
      <nav className="mobile-bottom-nav" aria-label="Navegação inferior móvel">
        {navItems.map(item => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mobile-nav-item ${active ? "active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {item.mobileIcon}
                {active && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: -4,
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: "var(--color-primary)",
                      boxShadow: "0 0 6px var(--color-primary)",
                    }}
                  />
                )}
              </div>
              <span>{item.shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

