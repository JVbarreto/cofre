"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthCard } from "@/components/ui/AuthCard";

export default function CadastroPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("As senhas não coincidem."); return; }
    if (password.length < 8) { setError("A senha deve ter pelo menos 8 caracteres."); return; }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name } },
    });
    if (error) { setError("Não foi possível criar a conta. Verifique os dados e tente novamente."); setLoading(false); }
    else { setSuccess(true); setLoading(false); }
  }

  if (success) return (
    <AuthCard title="Conta criada! 🎉" subtitle="Verifique seu e-mail para confirmar o cadastro.">
      <div style={{ textAlign: "center", paddingTop: 8 }}>
        <Link href="/login" style={{ color: "var(--color-primary)", fontWeight: 500, textDecoration: "none" }}>Ir para o login</Link>
      </div>
    </AuthCard>
  );

  return (
    <AuthCard
      title="Criar Conta"
      subtitle="Comece a registrar entradas e saídas em minutos."
      footer={<>Já tem uma conta? <Link href="/login">Entrar</Link></>}
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        
        {[
          { label: "Nome completo", type: "text", value: name, onChange: setName, placeholder: "Seu nome" },
          { label: "E-mail", type: "email", value: email, onChange: setEmail, placeholder: "seu@email.com" },
          { label: "Senha", type: "password", value: password, onChange: setPassword, placeholder: "Mínimo 8 caracteres" },
          { label: "Confirmar senha", type: "password", value: confirm, onChange: setConfirm, placeholder: "Repita a senha" },
        ].map((f) => (
          <div key={f.label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>{f.label}</label>
            <input 
              type={f.type} 
              value={f.value} 
              onChange={e => f.onChange(e.target.value)} 
              placeholder={f.placeholder} 
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
        ))}

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
          {loading ? "Criando conta..." : "Criar uma conta"}
        </button>

      </form>
    </AuthCard>
  );
}
