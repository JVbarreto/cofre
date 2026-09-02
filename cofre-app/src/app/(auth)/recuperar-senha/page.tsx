"use client";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthCard } from "@/components/ui/AuthCard";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setSent(true);
    setLoading(false);
  }

  return (
    <AuthCard
      title="Recuperar Senha"
      subtitle="Informe seu e-mail e enviaremos um link para redefinir sua senha."
      footer={<>Lembrou da senha? <Link href="/login">Voltar para o login</Link></>}
    >
      {sent ? (
        <div style={{ background: "rgba(34,197,94,.12)", border: "1px solid rgba(34,197,94,.3)", borderRadius: 8, padding: "16px", fontSize: 14, color: "#22c55e", textAlign: "center" }}>
          ✅ Link de recuperação enviado! Verifique seu e-mail.
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>E-mail</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="voce@email.com" 
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
            {loading ? "Enviando..." : "Enviar link de recuperação"}
          </button>
          
        </form>
      )}
    </AuthCard>
  );
}
