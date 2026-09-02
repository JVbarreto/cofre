"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

const navItems = [
  { href: "/dashboard",     icon: "🏠", label: "Dashboard" },
  { href: "/lancamentos",   icon: "💸", label: "Lançamentos" },
  { href: "/investimentos", icon: "📈", label: "Investimentos" },
  { href: "/relatorios",    icon: "📊", label: "Relatórios" },
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

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">🔐</div>
        <span className="logo-name">Cofre</span>
      </div>

      <span className="sidebar-section-label">Menu</span>

      <nav className="sidebar-nav">
        {navItems.map(item => {
          const active = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={`nav-item ${active ? "active" : ""}`}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-card" style={{ marginBottom: 12 }}>
          <div className="user-avatar">{user?.email?.[0].toUpperCase() || "U"}</div>
          <div className="user-info">
            <div className="user-name">Usuário</div>
            <div className="user-email">{user?.email || "Carregando..."}</div>
          </div>
        </div>
        <button onClick={handleLogout} className="nav-item" style={{ background: "transparent", border: "none", cursor: "pointer", width: "100%", padding: "10px 12px" }}>
          <span className="nav-icon">🚪</span>
          Sair
        </button>
      </div>
    </aside>
  );
}
