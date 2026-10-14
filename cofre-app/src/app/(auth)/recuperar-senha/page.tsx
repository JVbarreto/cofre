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
      title="Recuperar senha"
      subtitle="Informe seu e-mail e enviaremos um link para criar uma nova senha."
      footer={<>Lembrou da senha? <Link href="/login" className="link">Voltar para o login</Link></>}
    >
      {sent ? (
        <div className="notice notice-success" role="status">
          Se o e-mail estiver cadastrado, o link chega em instantes. Confira também o spam.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="form">
          <div className="field">
            <label className="label" htmlFor="email">E-mail</label>
            <input
              id="email" className="input" type="email" autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="voce@email.com" required
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary btn-block">
            {loading ? "Enviando..." : "Enviar link"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
