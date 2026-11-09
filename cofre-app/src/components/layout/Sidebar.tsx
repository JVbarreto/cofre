"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { LayoutDashboard, ArrowLeftRight, Landmark, ChartColumn, CalendarClock, LogOut, Vault, Bell } from "lucide-react";

const ICON_PROPS = { size: 18, strokeWidth: 1.75, "aria-hidden": true } as const;
const MOBILE_ICON_PROPS = { size: 20, strokeWidth: 1.8, "aria-hidden": true } as const;

const navItems = [
  { href: "/dashboard",      icon: <LayoutDashboard {...ICON_PROPS} />, mobileIcon: <LayoutDashboard {...MOBILE_ICON_PROPS} />, label: "Painel",       shortLabel: "Painel" },
  { href: "/lancamentos",    icon: <ArrowLeftRight {...ICON_PROPS} />,  mobileIcon: <ArrowLeftRight {...MOBILE_ICON_PROPS} />,  label: "Lançamentos",  shortLabel: "Lançamentos" },
  { href: "/contas-a-pagar", icon: <CalendarClock {...ICON_PROPS} />,   mobileIcon: <CalendarClock {...MOBILE_ICON_PROPS} />,   label: "Contas a Pagar", shortLabel: "Contas" },
  { href: "/investimentos",  icon: <Landmark {...ICON_PROPS} />,        mobileIcon: <Landmark {...MOBILE_ICON_PROPS} />,        label: "Investimentos", shortLabel: "Invest." },
  { href: "/relatorios",     icon: <ChartColumn {...ICON_PROPS} />,     mobileIcon: <ChartColumn {...MOBILE_ICON_PROPS} />,     label: "Relatórios",   shortLabel: "Relatórios" },
];

function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
      <Vault size={Math.round(size * 0.56)} strokeWidth={1.75} />
    </span>
  );
}

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

  const initials = displayName
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join("");


  return (
    <>
      {/* 1. Header Fixo no Mobile */}
      <header className="mobile-header" aria-label="Cabeçalho móvel">
        <Link href="/dashboard" className="brand">
          <BrandMark size={32} />
          Cofre
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Link href="/contas-a-pagar" className="icon-btn" title="Contas a pagar" aria-label="Contas a pagar">
            <Bell size={20} strokeWidth={1.75} aria-hidden="true" />
          </Link>
          <button onClick={handleLogout} className="icon-btn" title="Sair da conta" aria-label="Sair da conta">
            <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <span className="avatar" title={user?.email} aria-hidden="true">{initials}</span>
        </div>
      </header>

      {/* 2. Barra Lateral no Desktop */}
      <aside className="sidebar">
        <div className="brand">
          <BrandMark size={32} />
          Cofre
        </div>

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
                <span className="avatar" aria-hidden="true">{initials}</span>
                <div className="user-text">
                  <div className="user-name">{displayName}</div>
                  <div className="user-email">{user.email}</div>
                </div>
              </>
            ) : (
              <div className="skeleton" style={{ height: 32, width: "100%" }} aria-hidden="true" />
            )}
          </div>
          <button onClick={handleLogout} className="icon-btn" title="Sair da conta" aria-label="Sair da conta">
            <LogOut {...ICON_PROPS} />
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
              {item.mobileIcon}
              <span>{item.shortLabel}</span>
              {active && (
                <span
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: "var(--color-primary)",
                    boxShadow: "0 0 6px var(--color-primary)",
                    marginTop: -1,
                  }}
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

