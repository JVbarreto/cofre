interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  return (
    <header className="page-head">
      <div>
        <h1 className="h1">{title}</h1>
        {subtitle && <p className="muted" style={{ marginTop: "var(--sp-1)" }}>{subtitle}</p>}
      </div>
      {actions && <div>{actions}</div>}
    </header>
  );
}
