"use client";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthCard } from "@/components/ui/AuthCard";

export default function CadastroPage() {
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
    if (error) { console.error("signUp:", error.status, error.code, error.message); setError("Não foi possível criar a conta. Verifique os dados e tente novamente."); setLoading(false); }
    else { setSuccess(true); setLoading(false); }
  }

  if (success) return (
    <AuthCard title="Conta criada" subtitle="Enviamos um link de confirmação para o seu e-mail.">
      <Link href="/login" className="link">Ir para o login</Link>
    </AuthCard>
  );

  const fields = [
    { id: "name",     label: "Nome",            type: "text",     value: name,     onChange: setName,     autoComplete: "name",         placeholder: "Como você quer ser chamado" },
    { id: "email",    label: "E-mail",          type: "email",    value: email,    onChange: setEmail,    autoComplete: "email",        placeholder: "voce@email.com" },
    { id: "password", label: "Senha",           type: "password", value: password, onChange: setPassword, autoComplete: "new-password", placeholder: "Mínimo de 8 caracteres" },
    { id: "confirm",  label: "Confirmar senha", type: "password", value: confirm,  onChange: setConfirm,  autoComplete: "new-password", placeholder: "" },
  ];

  return (
    <AuthCard
      title="Criar conta"
      subtitle="Leva menos de um minuto."
      footer={<>Já tem conta? <Link href="/login" className="link">Entrar</Link></>}
    >
      <form onSubmit={handleSubmit} className="form">
        {fields.map(f => (
          <div key={f.id} className="field">
            <label className="label" htmlFor={f.id}>{f.label}</label>
            <input
              id={f.id} className="input" type={f.type} autoComplete={f.autoComplete}
              value={f.value} onChange={e => f.onChange(e.target.value)}
              placeholder={f.placeholder} required
            />
          </div>
        ))}

        {error && <p className="form-error" role="alert">{error}</p>}

        <button type="submit" disabled={loading} className="btn btn-primary btn-block">
          {loading ? "Criando conta..." : "Criar conta"}
        </button>
      </form>
    </AuthCard>
  );
}
