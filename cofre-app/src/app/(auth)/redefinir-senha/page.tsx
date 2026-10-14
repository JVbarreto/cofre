"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthCard } from "@/components/ui/AuthCard";
import Link from "next/link";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // O Supabase envia o link com um fragment hash (#access_token=...).
  // O método exchangeCodeForSession do @supabase/ssr lida com isso
  // automaticamente ao detectar o token na URL. Verificamos se a
  // sessão foi estabelecida antes de habilitar o formulário.
  useEffect(() => {
    const supabase = createClient();

    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        // Token de reset válido — sessão temporária ativa
        setSessionReady(true);
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      // Mensagem genérica — não vaza detalhes do Supabase
      setError("Não foi possível redefinir a senha. O link pode ter expirado. Solicite um novo.");
      setLoading(false);
    } else {
      setSuccess(true);
      // Faz logout para forçar novo login com a senha nova
      await supabase.auth.signOut();
      setTimeout(() => router.push("/login"), 2500);
    }
  }

  // Estado: token inválido ou link direto sem hash
  if (!sessionReady) {
    return (
      <AuthCard
        title="Redefinir senha"
        subtitle="Verificando o link de recuperação."
        footer={<>Link inválido ou expirado? <Link href="/recuperar-senha" className="link">Pedir um novo</Link></>}
      >
        <div className="notice notice-warning" role="status">
          Aguardando a confirmação do link. Se nada acontecer, ele pode ter expirado ou já ter sido usado.
        </div>
      </AuthCard>
    );
  }

  // Estado: senha redefinida com sucesso
  if (success) {
    return (
      <AuthCard title="Senha alterada" subtitle="Você será levado ao login em instantes.">
        <Link href="/login" className="link">Ir para o login agora</Link>
      </AuthCard>
    );
  }

  // Estado: formulário para nova senha
  const fields = [
    { id: "password", label: "Nova senha", value: password, onChange: setPassword, placeholder: "Mínimo de 8 caracteres" },
    { id: "confirm",  label: "Confirmar senha", value: confirm, onChange: setConfirm, placeholder: "" },
  ];

  return (
    <AuthCard
      title="Nova senha"
      subtitle="Use pelo menos 8 caracteres."
      footer={<Link href="/login" className="link">Voltar para o login</Link>}
    >
      <form onSubmit={handleSubmit} className="form">
        {fields.map(f => (
          <div key={f.id} className="field">
            <label className="label" htmlFor={f.id}>{f.label}</label>
            <input
              id={f.id} className="input" type="password" autoComplete="new-password"
              value={f.value} onChange={e => f.onChange(e.target.value)}
              placeholder={f.placeholder} required
            />
          </div>
        ))}

        {error && <p className="form-error" role="alert">{error}</p>}

        <button type="submit" disabled={loading} className="btn btn-primary btn-block">
          {loading ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
    </AuthCard>
  );
}
