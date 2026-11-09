"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthCard } from "@/components/ui/AuthCard";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("signIn:", error.status, error.code, error.message);
      setError("E-mail ou senha incorretos.");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <AuthCard
      title="Cofre"
      subtitle={
        <>
          <span className="only-d">Acesse seu livro-caixa pessoal</span>
          <span className="only-m">Acesse seu livro-caixa pelo celular</span>
        </>
      }
      footer={
        <>
          <span className="only-d">Não tem uma conta?</span>
          <span className="only-m">Não tem conta?</span>{" "}
          <Link href="/cadastro" className="link" style={{ fontWeight: "var(--weight-strong)" }}>Cadastre-se</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="form" style={{ gap: "var(--sp-4)" }}>
        <div className="field">
          <label className="field-label" htmlFor="email">E-mail</label>
          <input
            id="email" className="input" type="email" autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)}
            placeholder="voce@email.com" required
          />
        </div>

        <div className="field">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--sp-3)" }}>
            <label className="field-label" htmlFor="password">Senha</label>
            <Link href="/recuperar-senha" className="link" style={{ fontSize: "var(--text-xs)" }}>
              <span className="only-d">Esqueceu a senha?</span>
              <span className="only-m">Esqueceu?</span>
            </Link>
          </div>
          <div className="input-wrap">
            <input
              id="password" className="input" type={showPassword ? "text" : "password"} autoComplete="current-password"
              value={password} onChange={e => setPassword(e.target.value)} required
              style={{ paddingRight: 44 }}
            />
            <button
              type="button"
              className="input-icon-btn"
              onClick={() => setShowPassword(s => !s)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        <button type="submit" disabled={loading} className="btn btn-primary btn-block">
          {loading ? "Entrando..." : (
            <>
              <span className="only-d">Entrar no Cofre</span>
              <span className="only-m">Entrar</span>
            </>
          )}
        </button>
      </form>
    </AuthCard>
  );
}
