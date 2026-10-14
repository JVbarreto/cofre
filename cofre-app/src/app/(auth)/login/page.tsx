"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthCard } from "@/components/ui/AuthCard";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      title="Entrar"
      subtitle="Acesse seu livro-caixa."
      footer={<>Ainda não tem conta? <Link href="/cadastro" className="link">Criar conta</Link></>}
      showDivider
    >
      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label className="label" htmlFor="email">E-mail</label>
          <input
            id="email" className="input" type="email" autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)}
            placeholder="voce@email.com" required
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="password">Senha</label>
          <input
            id="password" className="input" type="password" autoComplete="current-password"
            value={password} onChange={e => setPassword(e.target.value)} required
          />
          <Link href="/recuperar-senha" className="link" style={{ fontSize: "var(--text-sm)", alignSelf: "flex-end" }}>
            Esqueci minha senha
          </Link>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        <button type="submit" disabled={loading} className="btn btn-primary btn-block">
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </AuthCard>
  );
}
