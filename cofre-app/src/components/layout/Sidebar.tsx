"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { LayoutDashboard, ArrowLeftRight, Landmark, ChartColumn, CalendarClock, LogOut } from "lucide-react";

const ICON_PROPS = { size: 18, strokeWidth: 1.75, "aria-hidden": true } as const;

const navItems = [
  { href: "/dashboard",      icon: <LayoutDashboard {...ICON_PROPS} />, label: "Painel" },
  { href: "/lancamentos",    icon: <ArrowLeftRight {...ICON_PROPS} />,  label: "Lançamentos" },
  { href: "/contas-a-pagar", icon: <CalendarClock {...ICON_PROPS} />,   label: "Contas a Pagar" },
  { href: "/investimentos",  icon: <Landmark {...ICON_PROPS} />,        label: "Investimentos" },
  { href: "/relatorios",     icon: <ChartColumn {...ICON_PROPS} />,     label: "Relatórios" },
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
  );
}
