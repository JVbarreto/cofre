interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  return (
    <header className="topbar">
      <div>
        <div className="page-title">{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: "var(--color-text-2)", marginTop: 2 }}>{subtitle}</div>}
      </div>
      {actions && <div className="topbar-right">{actions}</div>}
    </header>
  );
}
