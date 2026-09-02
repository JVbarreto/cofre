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
      subtitle="Acesse seu livro-caixa pessoal."
      footer={<>Não tem uma conta? <Link href="/cadastro">Criar uma conta</Link></>}
      showDivider
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>E-mail</label>
          <input 
            type="email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            placeholder="vitor@exemplo.com" 
            required 
            style={{ 
              width: "100%", height: 52, padding: "0 16px", borderRadius: 8, 
              background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
              color: "var(--color-text)", fontSize: 14, outline: "none"
            }}
            onFocus={(e) => {
              e.target.style.border = "1px solid var(--color-primary)";
              e.target.style.boxShadow = "0px 0px 0px 3px rgba(110,86,232,0.2)";
            }}
            onBlur={(e) => {
              e.target.style.border = "1px solid var(--color-border)";
              e.target.style.boxShadow = "none";
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>Senha</label>
          <input 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            placeholder="••••••••" 
            required 
            style={{ 
              width: "100%", height: 52, padding: "0 16px", borderRadius: 8, 
              background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
              color: "var(--color-text)", fontSize: 14, outline: "none"
            }}
            onFocus={(e) => {
              e.target.style.border = "1px solid var(--color-primary)";
              e.target.style.boxShadow = "0px 0px 0px 3px rgba(110,86,232,0.2)";
            }}
            onBlur={(e) => {
              e.target.style.border = "1px solid var(--color-border)";
              e.target.style.boxShadow = "none";
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -8 }}>
          <Link href="/recuperar-senha" style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)", textDecoration: "none" }}>
            Esqueci minha senha
          </Link>
        </div>

        {error && <p style={{ fontSize: 13, color: "var(--color-danger)", textAlign: "center" }}>{error}</p>}

        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            width: "100%", height: 52, background: "var(--color-primary)", 
            color: "var(--color-text)", fontSize: 14, fontWeight: 600, 
            borderRadius: 8, border: "none", cursor: loading ? "not-allowed" : "pointer",
            boxShadow: "0px 4px 24px 0px rgba(110, 86, 232, 0.33)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

      </form>
    </AuthCard>
  );
}
