"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatBRL } from "@/lib/utils/currency";
import type { Category, CategoriaRow, ImportanciaConta, FormaPagamentoConta, StatusConta } from "@/types/database";
import { mapCategoria } from "@/lib/data/mappers";
import {
  CalendarClock,
  Plus,
  Search,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  Trash2,
  Edit3,
  Calendar,
  DollarSign,
  StickyNote,
  Barcode,
  ArrowUpRight,
  Database as DatabaseIcon,
  X,
} from "lucide-react";

export type ContaPagarItem = {
  id: string;
  user_id: string;
  titulo: string;
  descricao: string | null;
  valor: number;
  prazo: string; // YYYY-MM-DD
  data_pagamento: string | null; // YYYY-MM-DD
  importancia: ImportanciaConta;
  status: StatusConta;
  categoria_id: string | null;
  codigo_barras: string | null;
  forma_pagamento: FormaPagamentoConta | null;
  recorrente: boolean;
  created_at: string;
};

const IMPORTANCIA_CONFIG: Record<
  ImportanciaConta,
  { label: string; badgeClass: string; border: string; color: string; icon: string }
> = {
  urgente: {
    label: "Urgente",
    badgeClass: "badge-danger",
    border: "rgba(248, 113, 113, 0.4)",
    color: "var(--color-danger)",
    icon: "🚨",
  },
  alta: {
    label: "Alta",
    badgeClass: "badge-warning",
    border: "rgba(251, 191, 36, 0.4)",
    color: "var(--color-warning)",
    icon: "⚠️",
  },
  media: {
    label: "Média",
    badgeClass: "",
    border: "rgba(59, 130, 246, 0.4)",
    color: "var(--color-primary)",
    icon: "🔹",
  },
  baixa: {
    label: "Baixa",
    badgeClass: "",
    border: "var(--color-border)",
    color: "var(--color-text-2)",
    icon: "⚪",
  },
};

const FORMA_PAGAMENTO_LABELS: Record<FormaPagamentoConta, { label: string; icon: string }> = {
  boleto: { label: "Boleto", icon: "📄" },
  pix: { label: "PIX", icon: "⚡" },
  cartao: { label: "Cartão", icon: "💳" },
  debito_automatico: { label: "Débito Automático", icon: "🔄" },
  dinheiro: { label: "Dinheiro", icon: "💵" },
  outro: { label: "Outro", icon: "🏷️" },
};

const STORAGE_KEY_PREFIX = "cofre_contas_pagar_";

export default function ContasPagarPage() {
  const [contas, setContas] = useState<ContaPagarItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [usingLocalStorage, setUsingLocalStorage] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSqlModal, setShowSqlModal] = useState(false);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todas" | "pendentes" | "atrasadas" | "pagas">("pendentes");
  const [importanciaFilter, setImportanciaFilter] = useState<string>("todas");
  const [sortBy, setSortBy] = useState<"prazo" | "importancia" | "valor" | "titulo">("prazo");

  // Modal formulário
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConta, setEditingConta] = useState<ContaPagarItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    valor: "",
    prazo: new Date().toISOString().split("T")[0],
    data_pagamento: "",
    importancia: "media" as ImportanciaConta,
    status: "pendente" as StatusConta,
    categoria_id: "",
    codigo_barras: "",
    forma_pagamento: "boleto" as FormaPagamentoConta,
    recorrente: false,
  });

  const todayIso = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Carregamento inicial
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        setUserId(user.id);

        // Carrega categorias de despesa
        const { data: catData } = (await supabase
          .from("categorias")
          .select("*")
          .eq("user_id", user.id)
          .eq("tipo", "saida")
          .order("nome")) as unknown as { data: CategoriaRow[] | null };

        setCategories((catData ?? []).map(mapCategoria));

        // Tenta carregar do Supabase
        let { data: contasData, error: contasError } = await (supabase as any)
          .from("contas_pagar")
          .select("*")
          .eq("user_id", user.id)
          .order("prazo", { ascending: true });

        if (contasError) {
          // Se a tabela ainda não existir no Supabase, usa localStorage de forma transparente
          console.warn("Supabase contas_pagar não encontrada ou sem permissão. Usando armazenamento local.", contasError);
          setUsingLocalStorage(true);
          const localData = localStorage.getItem(`${STORAGE_KEY_PREFIX}${user.id}`);
          if (localData) {
            try {
              setContas(JSON.parse(localData));
            } catch {
              setContas([]);
            }
          }
        } else {
          setUsingLocalStorage(false);
          // Se o banco na nuvem acabou de ser criado e está vazio, mas o usuário tinha anotações locais, migra automaticamente
          const localData = localStorage.getItem(`${STORAGE_KEY_PREFIX}${user.id}`);
          if ((!contasData || contasData.length === 0) && localData) {
            try {
              const parsedLocal: ContaPagarItem[] = JSON.parse(localData);
              if (parsedLocal.length > 0) {
                for (const item of parsedLocal) {
                  await (supabase as any).from("contas_pagar").insert({
                    user_id: user.id,
                    titulo: item.titulo,
                    descricao: item.descricao,
                    valor: item.valor,
                    prazo: item.prazo,
                    data_pagamento: item.data_pagamento,
                    importancia: item.importancia,
                    status: item.status,
                    categoria_id: item.categoria_id,
                    codigo_barras: item.codigo_barras,
                    forma_pagamento: item.forma_pagamento,
                    recorrente: item.recorrente,
                  });
                }
                localStorage.removeItem(`${STORAGE_KEY_PREFIX}${user.id}`);
                const { data: refreshed } = await (supabase as any)
                  .from("contas_pagar")
                  .select("*")
                  .eq("user_id", user.id)
                  .order("prazo", { ascending: true });
                contasData = refreshed ?? parsedLocal;
              }
            } catch (migErr) {
              console.warn("Erro ao migrar dados locais:", migErr);
            }
          }
          setContas((contasData as ContaPagarItem[]) ?? []);
        }
      } catch (err) {
        console.error("Erro geral ao carregar dados:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Salvar no storage local se necessário
  function persistLocal(items: ContaPagarItem[]) {
    if (userId) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(items));
    }
  }

  // Feedback temporário
  function showFeedback(text: string, type: "success" | "error" = "success") {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage(null), 4000);
  }

  // Abrir modal de criação
  function handleOpenCreate() {
    setEditingConta(null);
    setFormData({
      titulo: "",
      descricao: "",
      valor: "",
      prazo: new Date().toISOString().split("T")[0],
      data_pagamento: "",
      importancia: "media",
      status: "pendente",
      categoria_id: "",
      codigo_barras: "",
      forma_pagamento: "boleto",
      recorrente: false,
    });
    setIsModalOpen(true);
  }

  // Abrir modal de edição
  function handleOpenEdit(conta: ContaPagarItem) {
    setEditingConta(conta);
    setFormData({
      titulo: conta.titulo,
      descricao: conta.descricao ?? "",
      valor: conta.valor.toString(),
      prazo: conta.prazo,
      data_pagamento: conta.data_pagamento ?? "",
      importancia: conta.importancia,
      status: conta.status,
      categoria_id: conta.categoria_id ?? "",
      codigo_barras: conta.codigo_barras ?? "",
      forma_pagamento: conta.forma_pagamento ?? "boleto",
      recorrente: conta.recorrente,
    });
    setIsModalOpen(true);
  }

  // Alternar status de pago com 1 clique
  async function handleToggleStatus(conta: ContaPagarItem) {
    const novoStatus: StatusConta = conta.status === "pago" ? "pendente" : "pago";
    const novaDataPagamento = novoStatus === "pago" ? (conta.data_pagamento || todayIso) : null;

    const updatedItem: ContaPagarItem = {
      ...conta,
      status: novoStatus,
      data_pagamento: novaDataPagamento,
    };

    // Atualização otimista
    const newContas = contas.map(c => (c.id === conta.id ? updatedItem : c));
    setContas(newContas);

    if (usingLocalStorage || !userId) {
      persistLocal(newContas);
      showFeedback(novoStatus === "pago" ? "Conta marcada como paga!" : "Conta marcada como pendente.");
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await (supabase as any)
        .from("contas_pagar")
        .update({
          status: novoStatus,
          data_pagamento: novaDataPagamento,
        })
        .eq("id", conta.id)
        .eq("user_id", userId);

      if (error) {
        throw error;
      }
      showFeedback(novoStatus === "pago" ? "Conta marcada como paga!" : "Conta marcada como pendente.");
    } catch (err) {
      console.warn("Erro ao atualizar no Supabase, mantendo localmente:", err);
      persistLocal(newContas);
      setUsingLocalStorage(true);
      showFeedback("Atualizado localmente.", "success");
    }
  }

  // Excluir conta
  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja remover esta anotação de conta?")) return;

    const newContas = contas.filter(c => c.id !== id);
    setContas(newContas);

    if (usingLocalStorage || !userId) {
      persistLocal(newContas);
      showFeedback("Anotação excluída com sucesso.");
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await (supabase as any).from("contas_pagar").delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;
      showFeedback("Anotação excluída com sucesso.");
    } catch (err) {
      console.warn("Erro ao deletar no Supabase:", err);
      persistLocal(newContas);
      setUsingLocalStorage(true);
    }
  }

  // Salvar (Criar ou Editar)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.titulo.trim()) {
      showFeedback("Informe o título da conta.", "error");
      return;
    }

    setIsSubmitting(true);
    const parsedValor = parseFloat(formData.valor.replace(",", ".")) || 0;
    const finalDataPagamento = formData.status === "pago" ? (formData.data_pagamento || todayIso) : (formData.data_pagamento || null);

    if (editingConta) {
      // Edição
      const updated: ContaPagarItem = {
        ...editingConta,
        titulo: formData.titulo.trim(),
        descricao: formData.descricao.trim() || null,
        valor: parsedValor,
        prazo: formData.prazo,
        data_pagamento: finalDataPagamento,
        importancia: formData.importancia,
        status: formData.status,
        categoria_id: formData.categoria_id || null,
        codigo_barras: formData.codigo_barras.trim() || null,
        forma_pagamento: formData.forma_pagamento,
        recorrente: formData.recorrente,
      };

      const newContas = contas.map(c => (c.id === editingConta.id ? updated : c));
      setContas(newContas);

      if (!usingLocalStorage && userId) {
        try {
          const supabase = createClient();
          const { error } = await (supabase as any)
            .from("contas_pagar")
            .update({
              titulo: updated.titulo,
              descricao: updated.descricao,
              valor: updated.valor,
              prazo: updated.prazo,
              data_pagamento: updated.data_pagamento,
              importancia: updated.importancia,
              status: updated.status,
              categoria_id: updated.categoria_id,
              codigo_barras: updated.codigo_barras,
              forma_pagamento: updated.forma_pagamento,
              recorrente: updated.recorrente,
            })
            .eq("id", editingConta.id)
            .eq("user_id", userId);

          if (error) throw error;
        } catch (err) {
          console.warn("Erro ao salvar no Supabase, salvando local:", err);
          persistLocal(newContas);
          setUsingLocalStorage(true);
        }
      } else {
        persistLocal(newContas);
      }
      showFeedback("Conta atualizada com sucesso!");
    } else {
      // Criação
      const newId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `conta-${Date.now()}`;
      const newItem: ContaPagarItem = {
        id: newId,
        user_id: userId ?? "offline",
        titulo: formData.titulo.trim(),
        descricao: formData.descricao.trim() || null,
        valor: parsedValor,
        prazo: formData.prazo,
        data_pagamento: finalDataPagamento,
        importancia: formData.importancia,
        status: formData.status,
        categoria_id: formData.categoria_id || null,
        codigo_barras: formData.codigo_barras.trim() || null,
        forma_pagamento: formData.forma_pagamento,
        recorrente: formData.recorrente,
        created_at: new Date().toISOString(),
      };

      const newContas = [newItem, ...contas];
      setContas(newContas);

      if (!usingLocalStorage && userId) {
        try {
          const supabase = createClient();
          const { error } = await (supabase as any).from("contas_pagar").insert({
            id: newItem.id,
            user_id: userId,
            titulo: newItem.titulo,
            descricao: newItem.descricao,
            valor: newItem.valor,
            prazo: newItem.prazo,
            data_pagamento: newItem.data_pagamento,
            importancia: newItem.importancia,
            status: newItem.status,
            categoria_id: newItem.categoria_id,
            codigo_barras: newItem.codigo_barras,
            forma_pagamento: newItem.forma_pagamento,
            recorrente: newItem.recorrente,
          });
          if (error) throw error;
        } catch (err) {
          console.warn("Erro ao inserir no Supabase, salvando local:", err);
          persistLocal(newContas);
          setUsingLocalStorage(true);
        }
      } else {
        persistLocal(newContas);
      }
      showFeedback("Nova conta registrada com sucesso!");
    }

    setIsSubmitting(false);
    setIsModalOpen(false);
  }

  // Copiar código de barras ou PIX
  function handleCopy(codigo: string, id: string) {
    if (!codigo) return;
    navigator.clipboard.writeText(codigo);
    setCopiedId(id);
    showFeedback("Código copiado para a área de transferência!");
    setTimeout(() => setCopiedId(null), 2500);
  }

  // Registrar lançamento no livro-caixa caso esteja pago
  async function handleLancarNoCaixa(conta: ContaPagarItem) {
    if (!userId) return;
    try {
      const supabase = createClient();
      const { error } = await (supabase as any).from("transacoes").insert({
        user_id: userId,
        descricao: `[Conta Paga] ${conta.titulo}`,
        valor: conta.valor,
        tipo: "saida",
        categoria_id: conta.categoria_id || null,
        data: conta.data_pagamento || todayIso,
        recorrente: conta.recorrente,
      });

      if (error) {
        showFeedback("Não foi possível lançar no caixa automaticamente.", "error");
      } else {
        showFeedback("Lançamento adicionado ao livro-caixa do Cofre com sucesso!");
      }
    } catch {
      showFeedback("Erro ao registrar lançamento financeiro.", "error");
    }
  }

  // Cálculos e Métricas
  const metrics = useMemo(() => {
    let totalPendente = 0;
    let totalPago = 0;
    let totalAtrasado = 0;
    let countAtrasadas = 0;
    let countProximos7Dias = 0;
    let totalProximos7Dias = 0;

    const limit7Days = new Date();
    limit7Days.setDate(limit7Days.getDate() + 7);
    const limit7DaysIso = limit7Days.toISOString().split("T")[0];

    contas.forEach(c => {
      if (c.status === "pago") {
        totalPago += c.valor;
      } else {
        totalPendente += c.valor;
        if (c.prazo < todayIso) {
          totalAtrasado += c.valor;
          countAtrasadas++;
        } else if (c.prazo <= limit7DaysIso) {
          totalProximos7Dias += c.valor;
          countProximos7Dias++;
        }
      }
    });

    return {
      totalPendente,
      totalPago,
      totalAtrasado,
      countAtrasadas,
      countProximos7Dias,
      totalProximos7Dias,
      countTotal: contas.length,
    };
  }, [contas, todayIso]);

  // Lista filtrada e ordenada
  const filteredContas = useMemo(() => {
    return contas
      .filter(item => {
        // Busca textual
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchTitle = item.titulo.toLowerCase().includes(term);
          const matchDesc = item.descricao?.toLowerCase().includes(term) ?? false;
          const matchCode = item.codigo_barras?.toLowerCase().includes(term) ?? false;
          if (!matchTitle && !matchDesc && !matchCode) return false;
        }

        // Filtro de Status
        const isAtrasada = item.status === "pendente" && item.prazo < todayIso;
        if (statusFilter === "pendentes" && item.status !== "pendente") return false;
        if (statusFilter === "atrasadas" && !isAtrasada) return false;
        if (statusFilter === "pagas" && item.status !== "pago") return false;

        // Filtro de Importância
        if (importanciaFilter !== "todas" && item.importancia !== importanciaFilter) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "prazo") {
          return a.prazo.localeCompare(b.prazo);
        }
        if (sortBy === "importancia") {
          const pesos: Record<ImportanciaConta, number> = { urgente: 4, alta: 3, media: 2, baixa: 1 };
          return pesos[b.importancia] - pesos[a.importancia];
        }
        if (sortBy === "valor") {
          return b.valor - a.valor;
        }
        if (sortBy === "titulo") {
          return a.titulo.localeCompare(b.titulo);
        }
        return 0;
      });
  }, [contas, searchTerm, statusFilter, importanciaFilter, sortBy, todayIso]);

  // Auxiliar para formatação de data sem UTC offset
  const formatIsoDate = (iso: string | null) => {
    if (!iso) return "-";
    const parts = iso.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return iso;
  };

  // Cálculo de dias restantes ou de atraso
  const getPrazoBadge = (prazo: string, status: StatusConta) => {
    if (status === "pago") {
      return {
        label: `Venceu em ${formatIsoDate(prazo)}`,
        badgeClass: "badge",
        isAlert: false,
      };
    }

    const [ano, mes, dia] = prazo.split("-").map(Number);
    const prazoDate = new Date(ano, mes - 1, dia);
    const [tAno, tMes, tDia] = todayIso.split("-").map(Number);
    const todayDate = new Date(tAno, tMes - 1, tDia);

    const diffTime = prazoDate.getTime() - todayDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const diasAtraso = Math.abs(diffDays);
      return {
        label: `Atrasado há ${diasAtraso} ${diasAtraso === 1 ? "dia" : "dias"} (${formatIsoDate(prazo)})`,
        badgeClass: "badge-danger",
        isAlert: true,
      };
    }
    if (diffDays === 0) {
      return {
        label: `Vence hoje! (${formatIsoDate(prazo)})`,
        badgeClass: "badge-warning",
        isAlert: true,
      };
    }
    if (diffDays === 1) {
      return {
        label: `Vence amanhã (${formatIsoDate(prazo)})`,
        badgeClass: "badge-warning",
        isAlert: false,
      };
    }
    return {
      label: `Vence em ${diffDays} dias (${formatIsoDate(prazo)})`,
      badgeClass: "badge",
      isAlert: false,
    };
  };

  return (
    <div className="page" style={{ position: "relative" }}>
      {/* Toast Feedback */}
      {feedbackMessage && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 1000,
            padding: "12px 20px",
            borderRadius: "var(--radius-sm)",
            background: feedbackMessage.type === "success" ? "var(--color-surface-2)" : "var(--color-danger-bg)",
            color: feedbackMessage.type === "success" ? "var(--color-text)" : "var(--color-danger)",
            outline: `1px solid ${feedbackMessage.type === "success" ? "var(--color-primary)" : "var(--color-danger)"}`,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: "var(--text-sm)",
            fontWeight: "var(--weight-medium)",
          }}
        >
          {feedbackMessage.type === "success" ? <Check size={16} color="var(--color-success)" /> : <AlertTriangle size={16} />}
          {feedbackMessage.text}
        </div>
      )}

      {/* HEADER DA PÁGINA */}
      <header className="page-head">
        <div>
          <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>Planejamento Financeiro</span>
            {usingLocalStorage ? (
              <span
                style={{
                  fontSize: 10,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: "rgba(251, 191, 36, 0.15)",
                  color: "var(--color-warning)",
                  border: "1px solid rgba(251, 191, 36, 0.3)",
                }}
              >
                Modo Local (Offline/LocalStorage)
              </span>
            ) : (
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: "var(--color-success-bg)",
                  color: "var(--color-success)",
                  border: "1px solid rgba(52, 211, 153, 0.25)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-success)" }} />
                Supabase Sincronizado
              </span>
            )}
          </div>
          <h1 className="h1">Contas a Pagar</h1>
          <p className="muted" style={{ marginTop: 4, fontSize: "var(--text-sm)" }}>
            Controle de anotações, datas de pagamento, prazos de vencimento e prioridades.
          </p>
        </div>

        <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center", flexWrap: "wrap" }}>
          {usingLocalStorage && (
            <button
              onClick={() => setShowSqlModal(true)}
              className="btn btn-ghost"
              title="Ver Script SQL da tabela no Supabase"
              style={{ fontSize: "var(--text-sm)", height: 38 }}
            >
              <DatabaseIcon size={15} />
              SQL Supabase
            </button>
          )}

          <button onClick={handleOpenCreate} className="btn btn-primary" style={{ height: 38 }}>
            <Plus size={16} strokeWidth={2} />
            Nova Conta
          </button>
        </div>
      </header>

      {/* CARDS DE RESUMO / MÉTRICAS */}
      <div className="metrics-grid">
        {/* Total a Pagar */}
        <div className="metrics-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="eyebrow">Total a Pagar</span>
            <DollarSign size={16} className="muted" />
          </div>
          <div
            className="num metrics-num"
            style={{
              textAlign: "left",
            }}
          >
            {formatBRL(metrics.totalPendente)}
          </div>
          <div className="muted" style={{ fontSize: "var(--text-xs)" }}>
            {contas.filter(c => c.status === "pendente").length} conta(s) pendente(s)
          </div>
        </div>

        {/* Contas Atrasadas */}
        <div
          className="metrics-card"
          style={{
            background: metrics.countAtrasadas > 0 ? "rgba(248, 113, 113, 0.08)" : undefined,
            borderColor: metrics.countAtrasadas > 0 ? "rgba(248, 113, 113, 0.35)" : undefined,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="eyebrow" style={{ color: metrics.countAtrasadas > 0 ? "var(--color-danger)" : undefined }}>
              Atrasadas
            </span>
            <AlertTriangle size={16} color={metrics.countAtrasadas > 0 ? "var(--color-danger)" : "var(--color-text-3)"} />
          </div>
          <div
            className="num metrics-num"
            style={{
              textAlign: "left",
              color: metrics.countAtrasadas > 0 ? "var(--color-danger)" : "var(--color-text)",
            }}
          >
            {formatBRL(metrics.totalAtrasado)}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: metrics.countAtrasadas > 0 ? "var(--color-danger)" : "var(--color-text-3)" }}>
            {metrics.countAtrasadas} conta(s) fora do prazo
          </div>
        </div>

        {/* Vencem em breve (7 dias) */}
        <div
          className="metrics-card"
          style={{
            background: metrics.countProximos7Dias > 0 ? "rgba(251, 191, 36, 0.08)" : undefined,
            borderColor: metrics.countProximos7Dias > 0 ? "rgba(251, 191, 36, 0.35)" : undefined,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="eyebrow" style={{ color: metrics.countProximos7Dias > 0 ? "var(--color-warning)" : undefined }}>
              Próximos 7 Dias
            </span>
            <Clock size={16} color={metrics.countProximos7Dias > 0 ? "var(--color-warning)" : "var(--color-text-3)"} />
          </div>
          <div
            className="num metrics-num"
            style={{
              textAlign: "left",
              color: metrics.countProximos7Dias > 0 ? "var(--color-warning)" : "var(--color-text)",
            }}
          >
            {formatBRL(metrics.totalProximos7Dias)}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: metrics.countProximos7Dias > 0 ? "var(--color-warning)" : "var(--color-text-3)" }}>
            {metrics.countProximos7Dias} conta(s) para vencer
          </div>
        </div>

        {/* Já Pagas */}
        <div className="metrics-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="eyebrow">Total Pago</span>
            <CheckCircle2 size={16} color="var(--color-success)" />
          </div>
          <div
            className="num metrics-num"
            style={{
              textAlign: "left",
              color: "var(--color-success)",
            }}
          >
            {formatBRL(metrics.totalPago)}
          </div>
          <div className="muted" style={{ fontSize: "var(--text-xs)" }}>
            {contas.filter(c => c.status === "pago").length} conta(s) liquidada(s)
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS & PESQUISA */}
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          padding: "var(--sp-3) var(--sp-4)",
          display: "flex",
          gap: "var(--sp-3)",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {/* Campo de Busca */}
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180 }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--color-text-3)",
            }}
          />
          <input
            type="text"
            placeholder="Buscar por conta, anotação ou código..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input"
            style={{
              paddingLeft: 38,
              height: 38,
              fontSize: "var(--text-sm)",
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--color-text-3)",
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Segmented Status */}
        <div className="segmented" style={{ height: 38, padding: 2, overflowX: "auto", maxWidth: "100%", scrollbarWidth: "none" }}>
          {(
            [
              { id: "pendentes", label: "Pendentes" },
              { id: "atrasadas", label: "Atrasadas" },
              { id: "pagas", label: "Pagas" },
              { id: "todas", label: "Todas" },
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={statusFilter === tab.id}
              onClick={() => setStatusFilter(tab.id)}
              style={{ fontSize: "var(--text-xs)", padding: "0 10px", height: 32, whiteSpace: "nowrap" }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filtro de Importância */}
        <select
          value={importanciaFilter}
          onChange={e => setImportanciaFilter(e.target.value)}
          className="input"
          style={{ flex: "1 1 140px", minWidth: 130, height: 38, fontSize: "var(--text-sm)" }}
        >
          <option value="todas">Todas prioridades</option>
          <option value="urgente">🚨 Urgente</option>
          <option value="alta">⚠️ Alta</option>
          <option value="media">🔹 Média</option>
          <option value="baixa">⚪ Baixa</option>
        </select>

        {/* Ordenação */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          className="input"
          style={{ flex: "1 1 140px", minWidth: 130, height: 38, fontSize: "var(--text-sm)" }}
        >
          <option value="prazo">Ordenar: Prazo</option>
          <option value="importancia">Ordenar: Prioridade</option>
          <option value="valor">Ordenar: Maior Valor</option>
          <option value="titulo">Ordenar: Nome A-Z</option>
        </select>
      </div>

      {/* LISTA DE CONTAS A PAGAR */}
      <section className="section" aria-label="Lista de contas a pagar">
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 84 }} />
            ))}
          </div>
        ) : filteredContas.length === 0 ? (
          <div className="empty">
            <div className="empty-title">Nenhuma conta encontrada</div>
            <p>
              {searchTerm || statusFilter !== "todas" || importanciaFilter !== "todas"
                ? "Nenhuma conta corresponde aos filtros selecionados. Tente limpar a busca ou mudar o status."
                : "Você ainda não possui anotações de contas para pagar cadastradas."}
            </p>
            <button onClick={handleOpenCreate} className="btn btn-ghost" style={{ marginTop: "var(--sp-2)" }}>
              <Plus size={16} /> Cadastrar Nova Conta
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
            {filteredContas.map(conta => {
              const prazoInfo = getPrazoBadge(conta.prazo, conta.status);
              const importanciaInfo = IMPORTANCIA_CONFIG[conta.importancia];
              const formaInfo = conta.forma_pagamento ? FORMA_PAGAMENTO_LABELS[conta.forma_pagamento] : null;
              const categoriaObj = categories.find(c => c.id === conta.categoria_id);
              const isPago = conta.status === "pago";

              return (
                <div
                  key={conta.id}
                  style={{
                    background: isPago ? "var(--color-surface)" : "var(--color-surface)",
                    border: `1px solid ${prazoInfo.isAlert && !isPago ? prazoInfo.badgeClass === "badge-danger" ? "rgba(248, 113, 113, 0.45)" : "rgba(251, 191, 36, 0.45)" : "var(--color-border)"}`,
                    borderLeft: `4px solid ${importanciaInfo.color}`,
                    borderRadius: "var(--radius-sm)",
                    padding: "var(--sp-4) var(--sp-5)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--sp-3)",
                    transition: "border-color var(--dur) var(--ease), background var(--dur) var(--ease)",
                    opacity: isPago ? 0.78 : 1,
                  }}
                >
                  {/* Linha Principal */}
                  <div className="conta-item-main">
                    {/* Checkbox Status + Título + Badges */}
                    <div className="conta-info-col">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(conta)}
                        title={isPago ? "Marcar como pendente" : "Marcar como paga"}
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          padding: 2,
                          marginTop: 2,
                          color: isPago ? "var(--color-success)" : "var(--color-text-3)",
                          transition: "color var(--dur) var(--ease), transform 0.1s ease",
                        }}
                      >
                        {isPago ? (
                          <CheckCircle2 size={22} color="var(--color-success)" />
                        ) : (
                          <Circle size={22} />
                        )}
                      </button>

                      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontSize: "var(--text-md)",
                              fontWeight: "var(--weight-strong)",
                              color: isPago ? "var(--color-text-2)" : "var(--color-text)",
                              textDecoration: isPago ? "line-through" : "none",
                            }}
                          >
                            {conta.titulo}
                          </span>

                          {/* Badge de Importância */}
                          <span
                            className={`badge ${importanciaInfo.badgeClass}`}
                            style={{
                              border: `1px solid ${importanciaInfo.border}`,
                              color: importanciaInfo.color,
                            }}
                          >
                            {importanciaInfo.icon} {importanciaInfo.label}
                          </span>

                          {/* Recorrência */}
                          {conta.recorrente && (
                            <span className="badge" title="Repete todo mês">
                              🔄 Recorrente
                            </span>
                          )}

                          {/* Categoria */}
                          {categoriaObj && (
                            <span className="badge" style={{ color: "var(--color-text-2)" }}>
                              {categoriaObj.icon || "🏷️"} {categoriaObj.name}
                            </span>
                          )}

                          {/* Forma de Pagamento */}
                          {formaInfo && (
                            <span className="badge" style={{ color: "var(--color-text-3)" }}>
                              {formaInfo.icon} {formaInfo.label}
                            </span>
                          )}
                        </div>

                        {/* Linha de Datas: Prazo e Data de Pagamento */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            flexWrap: "wrap",
                            fontSize: "var(--text-xs)",
                            color: "var(--color-text-2)",
                          }}
                        >
                          <span
                            className={`badge ${prazoInfo.badgeClass}`}
                            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                          >
                            <Calendar size={12} />
                            Prazo: {prazoInfo.label}
                          </span>

                          {/* Data de Pagamento */}
                          {isPago ? (
                            <span
                              style={{
                                color: "var(--color-success)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                fontWeight: "var(--weight-medium)",
                              }}
                            >
                              <CheckCircle2 size={12} />
                              Pago em {formatIsoDate(conta.data_pagamento)}
                            </span>
                          ) : conta.data_pagamento ? (
                            <span style={{ color: "var(--color-primary)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <Clock size={12} />
                              Agendado p/ {formatIsoDate(conta.data_pagamento)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Valor e Ações */}
                    <div className="conta-valor-acoes">
                      <div style={{ textAlign: "right" }}>
                        <div
                          className="num"
                          style={{
                            fontSize: "var(--text-lg)",
                            fontWeight: "var(--weight-strong)",
                            color: isPago
                              ? "var(--color-text-2)"
                              : prazoInfo.isAlert && prazoInfo.badgeClass === "badge-danger"
                              ? "var(--color-danger)"
                              : "var(--color-text)",
                            textDecoration: isPago ? "line-through" : "none",
                          }}
                        >
                          {formatBRL(conta.valor)}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--color-text-3)" }}>
                          {isPago ? "Liquidado" : "A pagar"}
                        </div>
                      </div>

                      {/* Botões de Ação */}
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {/* Se pago, opção de lançar no caixa com 1 clique */}
                        {isPago && (
                          <button
                            type="button"
                            onClick={() => handleLancarNoCaixa(conta)}
                            className="btn btn-ghost"
                            style={{ height: 32, padding: "0 10px", fontSize: 12 }}
                            title="Lançar como despesa no livro-caixa do Cofre"
                          >
                            <ArrowUpRight size={13} /> Lançar no Caixa
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenEdit(conta)}
                          className="btn btn-ghost"
                          style={{ width: 32, height: 32, padding: 0 }}
                          title="Editar anotação"
                        >
                          <Edit3 size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(conta.id)}
                          className="btn btn-ghost"
                          style={{ width: 32, height: 32, padding: 0, color: "var(--color-danger)" }}
                          title="Excluir anotação"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Detalhes extras: Anotação / Observações */}
                  {conta.descricao && (
                    <div
                      style={{
                        background: "var(--color-surface-2)",
                        border: "1px dashed var(--color-border)",
                        borderRadius: "var(--radius-sm)",
                        padding: "8px 12px",
                        fontSize: "var(--text-xs)",
                        color: "var(--color-text-2)",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                      }}
                    >
                      <StickyNote size={14} style={{ flexShrink: 0, marginTop: 2, color: "var(--color-warning)" }} />
                      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{conta.descricao}</div>
                    </div>
                  )}

                  {/* Código de barras / Linha digitável ou Chave PIX */}
                  {conta.codigo_barras && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: "var(--color-surface-2)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-sm)",
                        padding: "6px 12px",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          minWidth: 0,
                          fontSize: "var(--text-xs)",
                          fontFamily: "monospace",
                          color: "var(--color-text-2)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Barcode size={14} color="var(--color-text-3)" />
                        <span style={{ userSelect: "all" }}>{conta.codigo_barras}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopy(conta.codigo_barras!, conta.id)}
                        className="btn btn-ghost"
                        style={{
                          height: 28,
                          padding: "0 10px",
                          fontSize: 11,
                          flexShrink: 0,
                          color: copiedId === conta.id ? "var(--color-success)" : undefined,
                        }}
                      >
                        {copiedId === conta.id ? (
                          <>
                            <Check size={12} color="var(--color-success)" /> Copiado!
                          </>
                        ) : (
                          <>
                            <Copy size={12} /> Copiar
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10, 14, 23, 0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 900,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--sp-4)",
          }}
          onClick={e => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 580,
              maxHeight: "90vh",
              overflowY: "auto",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border-light)",
              borderRadius: "var(--radius-md)",
              padding: "var(--sp-6)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--sp-5)",
              boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
            }}
          >
            {/* Cabeçalho do Modal */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 className="h2">{editingConta ? "Editar Anotação de Conta" : "Nova Anotação de Conta a Pagar"}</h2>
                <p className="muted" style={{ fontSize: "var(--text-xs)", marginTop: 2 }}>
                  Preencha os dados, prazo, data de pagamento e nível de importância.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="btn btn-ghost"
                style={{ width: 32, height: 32, padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="form">
              {/* Título / Credor */}
              <div className="field">
                <label className="label">Título da Conta / Credor*</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Aluguel, CEMIG, Cartão Nubank, Internet..."
                  value={formData.titulo}
                  onChange={e => setFormData(f => ({ ...f, titulo: e.target.value }))}
                  className="input"
                  autoFocus
                />
              </div>

              {/* Valor e Categoria */}
              <div className="field-row">
                <div className="field">
                  <label className="label">Valor Previsto (R$)*</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    placeholder="0,00"
                    value={formData.valor}
                    onChange={e => setFormData(f => ({ ...f, valor: e.target.value }))}
                    className="input"
                  />
                </div>

                <div className="field">
                  <label className="label">Categoria</label>
                  <select
                    value={formData.categoria_id}
                    onChange={e => setFormData(f => ({ ...f, categoria_id: e.target.value }))}
                    className="input"
                  >
                    <option value="">Sem categoria definida</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.icon || "🏷️"} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Prazo (Vencimento) e Data de Pagamento */}
              <div className="field-row">
                <div className="field">
                  <label className="label">Prazo de Vencimento*</label>
                  <input
                    type="date"
                    required
                    value={formData.prazo}
                    onChange={e => setFormData(f => ({ ...f, prazo: e.target.value }))}
                    className="input"
                  />
                  <span className="hint">Data limite para pagamento sem juros</span>
                </div>

                <div className="field">
                  <label className="label">Data de Pagamento</label>
                  <input
                    type="date"
                    value={formData.data_pagamento}
                    onChange={e => setFormData(f => ({ ...f, data_pagamento: e.target.value }))}
                    className="input"
                  />
                  <span className="hint">Data agendada ou em que foi paga</span>
                </div>
              </div>

              {/* Nível de Importância */}
              <div className="field">
                <label className="label">Nível de Importância / Prioridade*</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 6 }}>
                  {(
                    [
                      { id: "urgente", label: "Urgente", icon: "🚨", color: "var(--color-danger)" },
                      { id: "alta", label: "Alta", icon: "⚠️", color: "var(--color-warning)" },
                      { id: "media", label: "Média", icon: "🔹", color: "var(--color-primary)" },
                      { id: "baixa", label: "Baixa", icon: "⚪", color: "var(--color-text-2)" },
                    ] as const
                  ).map(imp => {
                    const selected = formData.importancia === imp.id;
                    return (
                      <button
                        key={imp.id}
                        type="button"
                        onClick={() => setFormData(f => ({ ...f, importancia: imp.id }))}
                        style={{
                          height: 38,
                          borderRadius: "var(--radius-sm)",
                          border: `1px solid ${selected ? imp.color : "var(--color-border)"}`,
                          background: selected ? "var(--color-surface-2)" : "transparent",
                          color: selected ? imp.color : "var(--color-text-2)",
                          fontSize: "var(--text-xs)",
                          fontWeight: selected ? "var(--weight-strong)" : "var(--weight-medium)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4,
                          transition: "all var(--dur) var(--ease)",
                        }}
                      >
                        <span>{imp.icon}</span> {imp.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Forma de Pagamento e Status */}
              <div className="field-row">
                <div className="field">
                  <label className="label">Forma de Pagamento</label>
                  <select
                    value={formData.forma_pagamento}
                    onChange={e => setFormData(f => ({ ...f, forma_pagamento: e.target.value as FormaPagamentoConta }))}
                    className="input"
                  >
                    <option value="boleto">📄 Boleto Bancário</option>
                    <option value="pix">⚡ PIX</option>
                    <option value="cartao">💳 Cartão de Crédito</option>
                    <option value="debito_automatico">🔄 Débito Automático</option>
                    <option value="dinheiro">💵 Dinheiro</option>
                    <option value="outro">🏷️ Outro</option>
                  </select>
                </div>

                <div className="field">
                  <label className="label">Status Inicial</label>
                  <select
                    value={formData.status}
                    onChange={e => {
                      const newStatus = e.target.value as StatusConta;
                      setFormData(f => ({
                        ...f,
                        status: newStatus,
                        data_pagamento: newStatus === "pago" && !f.data_pagamento ? todayIso : f.data_pagamento,
                      }));
                    }}
                    className="input"
                  >
                    <option value="pendente">⏳ Pendente</option>
                    <option value="pago">✅ Já Pago</option>
                  </select>
                </div>
              </div>

              {/* Código de barras / Chave PIX */}
              <div className="field">
                <label className="label">Código de Barras / Chave PIX Copia e Cola</label>
                <input
                  type="text"
                  placeholder="Cole aqui a linha digitável ou chave PIX para facilitar o pagamento"
                  value={formData.codigo_barras}
                  onChange={e => setFormData(f => ({ ...f, codigo_barras: e.target.value }))}
                  className="input"
                  style={{ fontFamily: "monospace", fontSize: "var(--text-xs)" }}
                />
              </div>

              {/* Anotações / Observações */}
              <div className="field">
                <label className="label">Anotações / Observações Especiais</label>
                <textarea
                  rows={3}
                  placeholder="Ex: Pagar antes das 16h para ter 10% de desconto. Aguardando validação do síndico."
                  value={formData.descricao}
                  onChange={e => setFormData(f => ({ ...f, descricao: e.target.value }))}
                  className="input"
                  style={{ height: "auto", padding: "8px 12px", resize: "vertical" }}
                />
              </div>

              {/* Recorrência */}
              <label className="check" style={{ marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={formData.recorrente}
                  onChange={e => setFormData(f => ({ ...f, recorrente: e.target.checked }))}
                />
                <span style={{ fontSize: "var(--text-sm)" }}>Conta recorrente (repete todos os meses)</span>
              </label>

              {/* Ações do Formulário */}
              <div className="form-actions" style={{ marginTop: "var(--sp-4)" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-ghost"
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? "Salvando..." : editingConta ? "Salvar Alterações" : "Adicionar Conta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SCRIPT SQL SUPABASE */}
      {showSqlModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10, 14, 23, 0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 950,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--sp-4)",
          }}
          onClick={e => {
            if (e.target === e.currentTarget) setShowSqlModal(false);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 640,
              maxHeight: "85vh",
              overflowY: "auto",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border-light)",
              borderRadius: "var(--radius-md)",
              padding: "var(--sp-6)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--sp-4)",
              boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 className="h2">Sincronização com o Supabase</h2>
                <p className="muted" style={{ fontSize: "var(--text-xs)" }}>
                  Execute este script no SQL Editor do seu Supabase para persistir suas contas na nuvem.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="btn btn-ghost"
                style={{ width: 32, height: 32, padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                background: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                padding: "var(--sp-4)",
                fontFamily: "monospace",
                fontSize: 12,
                color: "var(--color-text)",
                maxHeight: 280,
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                lineHeight: 1.5,
              }}
            >
              {`-- ============================================================
-- COFRE — Migration: Contas a Pagar
-- Execute no SQL Editor do Supabase (dashboard.supabase.com)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contas_pagar (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  titulo          text NOT NULL,
  descricao       text,
  valor           numeric(12,2) NOT NULL DEFAULT 0,
  prazo           date NOT NULL,
  data_pagamento  date,
  importancia     text NOT NULL DEFAULT 'media' CHECK (importancia IN ('baixa', 'media', 'alta', 'urgente')),
  status          text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago')),
  categoria_id    uuid,
  codigo_barras   text,
  forma_pagamento text DEFAULT 'boleto' CHECK (forma_pagamento IN ('pix', 'boleto', 'cartao', 'debito_automatico', 'dinheiro', 'outro')),
  recorrente      boolean DEFAULT false NOT NULL,
  created_at      timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_user ON public.contas_pagar (user_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_prazo ON public.contas_pagar (prazo);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status ON public.contas_pagar (status);

ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contas_pagar: crud proprio" ON public.contas_pagar;
CREATE POLICY "contas_pagar: crud proprio"
  ON public.contas_pagar FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);`}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <span className="hint">Arquivo gravado em: cofre-app-sql/003_contas_pagar.sql</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`CREATE TABLE IF NOT EXISTS public.contas_pagar (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  titulo          text NOT NULL,
  descricao       text,
  valor           numeric(12,2) NOT NULL DEFAULT 0,
  prazo           date NOT NULL,
  data_pagamento  date,
  importancia     text NOT NULL DEFAULT 'media' CHECK (importancia IN ('baixa', 'media', 'alta', 'urgente')),
  status          text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago')),
  categoria_id    uuid,
  codigo_barras   text,
  forma_pagamento text DEFAULT 'boleto' CHECK (forma_pagamento IN ('pix', 'boleto', 'cartao', 'debito_automatico', 'dinheiro', 'outro')),
  recorrente      boolean DEFAULT false NOT NULL,
  created_at      timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_user ON public.contas_pagar (user_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_prazo ON public.contas_pagar (prazo);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status ON public.contas_pagar (status);

ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contas_pagar: crud proprio" ON public.contas_pagar;
CREATE POLICY "contas_pagar: crud proprio"
  ON public.contas_pagar FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);`);
                  showFeedback("SQL copiado com sucesso!");
                }}
                className="btn btn-primary"
              >
                <Copy size={14} /> Copiar SQL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
