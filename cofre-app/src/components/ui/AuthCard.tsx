import Link from "next/link";

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showDivider?: boolean;
}

export function AuthCard({ title, subtitle, children, footer, showDivider = false }: AuthCardProps) {
  return (
    <div style={{ display: "flex", width: "100%", minHeight: "100vh", backgroundColor: "var(--color-bg)", overflow: "hidden" }}>
      
      {/* Brand Panel */}
      <div style={{ flex: "0 0 560px", display: "flex", flexDirection: "column", gap: 20, padding: "0 72px", justifyContent: "center", alignItems: "flex-start", position: "relative" }}>
        <div style={{ fontSize: 64, fontWeight: 600, color: "var(--color-text)", letterSpacing: "-0.5px" }}>
          Cofre
        </div>
        <div style={{ width: 72, height: 3, background: "var(--color-primary)", boxShadow: "0px 0px 12px 0px rgba(110, 86, 232, 0.33)" }} />
        <div style={{ fontSize: 16, lineHeight: "26px", color: "var(--color-text-2)", width: 340 }}>
          Livro-caixa pessoal: registre, acompanhe e invista com a clareza de um razão antigo.
        </div>
        
        <div style={{ position: "absolute", bottom: 40, left: 72, fontSize: 12, color: "var(--color-text-3)" }}>
          © {new Date().getFullYear()} Cofre · v1.0
        </div>
      </div>

      {/* Form Panel */}
      <div style={{ flex: 1, backgroundColor: "var(--color-surface)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <div style={{ width: 400, display: "flex", flexDirection: "column", gap: 20 }}>
          
          <div>
            <div style={{ fontSize: 36, fontWeight: 600, color: "var(--color-text)", letterSpacing: "-0.5px", marginBottom: 8 }}>
              {title}
            </div>
            <div style={{ fontSize: 14, color: "var(--color-text-2)" }}>
              {subtitle}
            </div>
          </div>

          {children}

          {footer && (
            <>
              {showDivider && (
                <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "8px 0" }}>
                  <div style={{ flex: 1, height: 1, backgroundColor: "var(--color-border)" }} />
                  <div style={{ fontSize: 12, color: "var(--color-text-3)" }}>ou</div>
                  <div style={{ flex: 1, height: 1, backgroundColor: "var(--color-border)" }} />
                </div>
              )}
              <div style={{ textAlign: "center", fontSize: 13, color: "var(--color-text-2)", marginTop: showDivider ? 0 : 8 }}>
                {footer}
              </div>
            </>
          )}

        </div>
      </div>

    </div>
  );
}
