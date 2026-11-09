import { Vault } from "lucide-react";

interface AuthCardProps {
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showDivider?: boolean;
}

export function AuthCard({ title, subtitle, children, footer, showDivider = false }: AuthCardProps) {
  return (
    <main className="auth-card">
      <div className="auth-head">
        <span className="brand-mark" style={{ width: 44, height: 44 }} aria-hidden="true">
          <Vault size={24} strokeWidth={1.75} />
        </span>
        <h1 className="auth-title">{title}</h1>
        <p className="muted" style={{ fontSize: "var(--text-sm)" }}>{subtitle}</p>
      </div>

      {children}

      {footer && (
        <>
          {showDivider && <hr style={{ border: 0, borderTop: "1px solid var(--color-border)" }} />}
          <div className="auth-footer">{footer}</div>
        </>
      )}
    </main>
  );
}
