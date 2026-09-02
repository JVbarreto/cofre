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
        title="Redefinir Senha"
        subtitle="Aguardando verificação do link..."
        footer={<>Link inválido ou expirado? <Link href="/recuperar-senha">Solicitar novo link</Link></>}
      >
        <div style={{
          background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)",
          borderRadius: 8, padding: 16, fontSize: 14, color: "var(--color-warning)", textAlign: "center"
        }}>
          ⏳ Verificando link de recuperação...
          <br />
          <span style={{ fontSize: 12, color: "var(--color-text-2)", display: "block", marginTop: 8 }}>
            Se nada acontecer, o link pode ter expirado ou já ter sido usado.
          </span>
        </div>
      </AuthCard>
    );
  }

  // Estado: senha redefinida com sucesso
  if (success) {
    return (
      <AuthCard title="Senha redefinida! ✅" subtitle="Você será redirecionado para o login em instantes.">
        <div style={{
          background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)",
          borderRadius: 8, padding: 16, fontSize: 14, color: "var(--color-success)", textAlign: "center"
        }}>
          ✅ Senha alterada com sucesso!
          <br />
          <Link href="/login" style={{ color: "var(--color-primary)", fontWeight: 500, textDecoration: "none", display: "block", marginTop: 8 }}>
            Ir para o login agora →
          </Link>
        </div>
      </AuthCard>
    );
  }

  // Estado: formulário para nova senha
  return (
    <AuthCard
      title="Nova Senha"
      subtitle="Escolha uma senha forte com pelo menos 8 caracteres."
      footer={<><Link href="/login">Voltar para o login</Link></>}
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {[
          { label: "Nova senha", value: password, onChange: setPassword, placeholder: "Mínimo 8 caracteres" },
          { label: "Confirmar senha", value: confirm, onChange: setConfirm, placeholder: "Repita a nova senha" },
        ].map((f) => (
          <div key={f.label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>{f.label}</label>
            <input
              type="password"
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
          {loading ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
    </AuthCard>
  );
}
