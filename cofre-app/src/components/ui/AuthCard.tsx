interface AuthCardProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showDivider?: boolean;
}

export function AuthCard({ title, subtitle, children, footer, showDivider = false }: AuthCardProps) {
  return (
    <>
      <section className="auth-brand" aria-label="Cofre">
        <div>
          <div className="brand-name">Cofre</div>
          <p>Seu livro-caixa pessoal: o que entrou, o que saiu e quanto está investido.</p>
        </div>
        <div className="eyebrow">© {new Date().getFullYear()} Cofre</div>
      </section>

      <main className="auth-form">
        <div className="auth-form-inner">
          <div>
            <h1 className="h1" style={{ marginBottom: "var(--sp-2)" }}>{title}</h1>
            <p className="muted">{subtitle}</p>
          </div>

          {children}

          {footer && (
            <>
              {showDivider && <hr style={{ border: 0, borderTop: "1px solid var(--color-border)" }} />}
              <div className="auth-footer">{footer}</div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
