"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatBRL } from "@/lib/utils/currency";
import type { Category, CategoriaRow, ImportanciaConta, FormaPagamentoConta, StatusConta } from "@/types/database";
import { mapCategoria } from "@/lib/data/mappers";
import {
  Plus,
  Search,
  Check,
  Copy,
  Trash2,
  Edit3,
  ArrowUpRight,
  Database as DatabaseIcon,
  AlertTriangle,
  CircleAlert,
  CircleCheck,
  Timer,
  FileText,
  EllipsisVertical,
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

type StatusFilter = "todas" | "atrasadas" | "avencer" | "pagas";

// Diferença em dias entre duas datas ISO (YYYY-MM-DD), sem depender de fuso horário
function dayDiff(aIso: string, bIso: string) {
  const [ay, am, ad] = aIso.split("-").map(Number);
  const [by, bm, bd] = bIso.split("-").map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000);
}

function localTodayIso() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const brlCompact = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

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

  const todayIso = useMemo(() => localTodayIso(), []);

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

  // Trava scroll do body e fecha modais com Escape (acessibilidade WAI-ARIA)
  useEffect(() => {
    if (!isModalOpen && !showSqlModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsModalOpen(false);
        setShowSqlModal(false);
      }
    };
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isModalOpen, showSqlModal]);

  // Fecha o menu de ações da linha ao clicar fora dele
  useEffect(() => {
    if (!menuOpenId) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-row-menu]")) setMenuOpenId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpenId(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpenId]);

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
    let countPagasMes = 0;
    let countProximos7Dias = 0;
    let totalProximos7Dias = 0;

    contas.forEach(c => {
      if (c.status === "pago") {
        // "Pagas no mês": considera a data de pagamento (ou o prazo, se não informada)
        if ((c.data_pagamento || c.prazo).slice(0, 7) === todayIso.slice(0, 7)) {
          totalPago += c.valor;
          countPagasMes++;
        }
      } else {
        totalPendente += c.valor;
        if (c.prazo < todayIso) {
          totalAtrasado += c.valor;
          countAtrasadas++;
        } else if (dayDiff(c.prazo, todayIso) <= 7) {
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
      countPagasMes,
      countProximos7Dias,
      totalProximos7Dias,
      countTotal: contas.length,
    };
  }, [contas, todayIso]);

  // Contagem por aba
  const tabCounts = useMemo(() => {
    const counts = { todas: contas.length, atrasadas: 0, avencer: 0, pagas: 0 };
    contas.forEach(c => {
      if (c.status === "pago") counts.pagas++;
      else if (c.prazo < todayIso) counts.atrasadas++;
      else counts.avencer++;
    });
    return counts;
  }, [contas, todayIso]);

  // Lista filtrada e ordenada: pendentes primeiro (prazo mais próximo no topo), pagas por último
  const filteredContas = useMemo(() => {
    return contas
      .filter(item => {
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchTitle = item.titulo.toLowerCase().includes(term);
          const matchDesc = item.descricao?.toLowerCase().includes(term) ?? false;
          const matchCode = item.codigo_barras?.toLowerCase().includes(term) ?? false;
          const matchCat = categories.find(cat => cat.id === item.categoria_id)?.name.toLowerCase().includes(term) ?? false;
          if (!matchTitle && !matchDesc && !matchCode && !matchCat) return false;
        }

        const isPago = item.status === "pago";
        const isAtrasada = !isPago && item.prazo < todayIso;
        if (statusFilter === "atrasadas") return isAtrasada;
        if (statusFilter === "avencer") return !isPago && !isAtrasada;
        if (statusFilter === "pagas") return isPago;
        return true;
      })
      .sort((a, b) => {
        const aPago = a.status === "pago" ? 1 : 0;
        const bPago = b.status === "pago" ? 1 : 0;
        if (aPago !== bPago) return aPago - bPago;
        return aPago ? b.prazo.localeCompare(a.prazo) : a.prazo.localeCompare(b.prazo);
      });
  }, [contas, categories, searchTerm, statusFilter, todayIso]);
  // Auxiliar para formatação de data sem UTC offset
  const formatIsoDate = (iso: string | null) => {
    if (!iso) return "-";
    const parts = iso.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return iso;
  };

  return (
    <div className="page" style={{ position: "relative" }}>
      {/* Toast Feedback */}
      {feedbackMessage && (
        <div
          className="toast"
          style={{
            position: "fixed",
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
      <header className="page-head" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 className="h1">Contas a Pagar</h1>
          <p className="page-sub only-d">Controle de compromissos financeiros e datas de vencimento</p>
          {usingLocalStorage && (
            <span className="badge badge-warning" style={{ display: "inline-block", marginTop: "var(--sp-2)" }}>
              Modo local · salvo neste navegador
            </span>
          )}
        </div>

        <div className="head-actions">
          {usingLocalStorage && (
            <button
              onClick={() => setShowSqlModal(true)}
              className="btn btn-ghost only-d"
              title="Ver Script SQL da tabela no Supabase"
            >
              <DatabaseIcon size={15} aria-hidden="true" />
              SQL Supabase
            </button>
          )}
          <button onClick={handleOpenCreate} className="btn btn-primary" style={{ borderRadius: "var(--radius-md)", width: "auto" }}>
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            <span className="only-d">Nova Conta</span>
            <span className="only-m">Conta</span>
          </button>
        </div>
      </header>

      {/* CARDS DE RESUMO */}
      <div className="summary-row contas-summary">
        <section
          className="summary-card"
          style={{ gap: 10, padding: "var(--sp-4)", cursor: "pointer" }}
          aria-label="Contas vencidas"
          onClick={() => setStatusFilter(s => (s === "atrasadas" ? "todas" : "atrasadas"))}
        >
          <div className="metric-top">
            <span className="metric-label">
              <span className="only-d">Contas Vencidas</span>
              <span className="only-m">Vencidas</span>
            </span>
            <CircleAlert size={18} color="var(--color-danger)" className="only-d" aria-hidden="true" />
          </div>
          <div className="metric-bottom">
            <span className="num metric-value" style={{ color: "var(--color-danger)" }}>
              <span className="only-d">{formatBRL(metrics.totalAtrasado)}</span>
              <span className="only-m">{brlCompact(metrics.totalAtrasado)}</span>
            </span>
            <span className="count-badge only-d" style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
              {metrics.countAtrasadas} {metrics.countAtrasadas === 1 ? "conta" : "contas"}
            </span>
          </div>
        </section>

        <section
          className="summary-card"
          style={{ gap: 10, padding: "var(--sp-4)", cursor: "pointer" }}
          aria-label="A vencer nos próximos 7 dias"
          onClick={() => setStatusFilter(s => (s === "avencer" ? "todas" : "avencer"))}
        >
          <div className="metric-top">
            <span className="metric-label">
              <span className="only-d">A Vencer nos Próximos 7 Dias</span>
              <span className="only-m">A Vencer</span>
            </span>
            <Timer size={18} color="var(--color-warning)" className="only-d" aria-hidden="true" />
          </div>
          <div className="metric-bottom">
            <span className="num metric-value" style={{ color: "var(--color-warning)" }}>
              <span className="only-d">{formatBRL(metrics.totalProximos7Dias)}</span>
              <span className="only-m">{brlCompact(metrics.totalProximos7Dias)}</span>
            </span>
            <span className="count-badge only-d" style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}>
              {metrics.countProximos7Dias} {metrics.countProximos7Dias === 1 ? "conta" : "contas"}
            </span>
          </div>
        </section>

        <section
          className="summary-card"
          style={{ gap: 10, padding: "var(--sp-4)", cursor: "pointer" }}
          aria-label="Pagas no mês"
          onClick={() => setStatusFilter(s => (s === "pagas" ? "todas" : "pagas"))}
        >
          <div className="metric-top">
            <span className="metric-label">
              <span className="only-d">Pagas no Mês</span>
              <span className="only-m">Pagas</span>
            </span>
            <CircleCheck size={18} color="var(--color-success)" className="only-d" aria-hidden="true" />
          </div>
          <div className="metric-bottom">
            <span className="num metric-value" style={{ color: "var(--color-success)" }}>
              <span className="only-d">{formatBRL(metrics.totalPago)}</span>
              <span className="only-m">{brlCompact(metrics.totalPago)}</span>
            </span>
            <span className="count-badge only-d" style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
              {metrics.countPagasMes} {metrics.countPagasMes === 1 ? "conta" : "contas"}
            </span>
          </div>
        </section>
      </div>

      {/* ABAS DE STATUS E BUSCA */}
      <div className="filter-row">
        <div className="tabs" role="group" aria-label="Filtrar por status">
          {(
            [
              { id: "todas", label: "Todas" },
              { id: "atrasadas", label: "Vencidas" },
              { id: "avencer", label: "A Vencer" },
              { id: "pagas", label: "Pagas" },
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              type="button"
              className="tab"
              aria-pressed={statusFilter === tab.id}
              onClick={() => setStatusFilter(tab.id)}
            >
              {tab.label} ({tabCounts[tab.id]})
            </button>
          ))}
        </div>

        <div className="search-box">
          <Search size={14} aria-hidden="true" />
          <input
            type="text"
            placeholder="Buscar conta ou fornecedor..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input"
            aria-label="Buscar conta ou fornecedor"
          />
        </div>
      </div>

      {/* TABELA DE CONTAS A PAGAR */}
      <section aria-label="Lista de contas a pagar">
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton" style={{ height: 56 }} />
            ))}
          </div>
        ) : filteredContas.length === 0 ? (
          <div className="empty">
            <div className="empty-title">Nenhuma conta encontrada</div>
            <p>
              {searchTerm || statusFilter !== "todas"
                ? "Nenhuma conta corresponde aos filtros selecionados. Tente limpar a busca ou mudar o status."
                : "Você ainda não possui anotações de contas para pagar cadastradas."}
            </p>
            <button onClick={handleOpenCreate} className="btn btn-ghost" style={{ marginTop: "var(--sp-2)" }}>
              <Plus size={16} /> Cadastrar Nova Conta
            </button>
          </div>
        ) : (
          <div className="bills-table bills-cols">
            <div className="table-head">
              <div>Conta &amp; Categoria</div>
              <div>Vencimento</div>
              <div>Status</div>
              <div>Valor (R$)</div>
              <div style={{ textAlign: "right" }}>Ações</div>
            </div>

            {filteredContas.map(conta => {
              const isPago = conta.status === "pago";
              const diff = dayDiff(conta.prazo, todayIso);
              const isAtrasada = !isPago && diff < 0;

              const statusInfo = isPago
                ? { label: "Paga", color: "var(--color-success)", bg: "var(--color-success-bg)" }
                : isAtrasada
                  ? { label: "Vencida", color: "var(--color-danger)", bg: "var(--color-danger-bg)" }
                  : { label: "A Vencer", color: "var(--color-warning)", bg: "var(--color-warning-bg)" };

              let relative = "";
              if (!isPago) {
                if (diff === -1) relative = " (Ontem)";
                else if (diff < -1) relative = " (Atrasada)";
                else if (diff === 0) relative = " (Hoje)";
                else if (diff === 1) relative = " (Amanhã)";
                else if (diff <= 7) relative = ` (Em ${diff} dias)`;
              }

              const categoriaObj = categories.find(c => c.id === conta.categoria_id);
              const formaInfo = conta.forma_pagamento ? FORMA_PAGAMENTO_LABELS[conta.forma_pagamento] : null;
              const importanciaInfo = IMPORTANCIA_CONFIG[conta.importancia];
              const showImportancia = !isPago && (conta.importancia === "urgente" || conta.importancia === "alta");

              return (
                <div key={conta.id} className="table-row">
                  <div className="bill-cell-main">
                    <span className="bill-icon" aria-hidden="true">
                      <FileText size={14} color={statusInfo.color} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="bill-title" style={{ color: isPago ? "var(--color-text-2)" : undefined }} title={conta.descricao ?? undefined}>
                        {conta.titulo}
                      </div>
                      <div className="bill-sub">
                        {categoriaObj?.name ?? formaInfo?.label ?? "Sem categoria"}
                        {conta.recorrente && " · Recorrente"}
                        {showImportancia && (
                          <span style={{ color: importanciaInfo.color, fontWeight: "var(--weight-strong)" }}> · {importanciaInfo.label}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: "var(--text-xs)", color: isAtrasada ? "var(--color-danger)" : "var(--color-text-2)", whiteSpace: "nowrap" }}>
                    {formatIsoDate(conta.prazo)}{relative}
                  </div>

                  <div>
                    <span className="count-badge" style={{ background: statusInfo.bg, color: statusInfo.color, display: "inline-block" }}>
                      {statusInfo.label}
                    </span>
                  </div>

                  <div className="num" style={{ textAlign: "left", fontSize: "var(--text-sm)", fontWeight: "var(--weight-strong)", color: isPago ? "var(--color-text-3)" : "var(--color-text)" }}>
                    {formatBRL(conta.valor)}
                  </div>

                  <div className="bill-actions" data-row-menu>
                    {isPago ? (
                      <button
                        type="button"
                        className="btn-paid"
                        onClick={() => handleToggleStatus(conta)}
                        title="Marcar como pendente"
                        aria-label={`${conta.titulo}: paga. Marcar como pendente`}
                      >
                        Paga <Check size={12} aria-hidden="true" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-pay"
                        onClick={() => handleToggleStatus(conta)}
                        aria-label={`Marcar ${conta.titulo} como paga`}
                      >
                        <Check size={12} aria-hidden="true" /> Pagar
                      </button>
                    )}

                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setMenuOpenId(menuOpenId === conta.id ? null : conta.id)}
                      aria-haspopup="menu"
                      aria-expanded={menuOpenId === conta.id}
                      aria-label={`Mais ações para ${conta.titulo}`}
                    >
                      <EllipsisVertical size={16} aria-hidden="true" />
                    </button>

                    {menuOpenId === conta.id && (
                      <div className="row-menu" role="menu">
                        <button type="button" role="menuitem" onClick={() => { setMenuOpenId(null); handleOpenEdit(conta); }}>
                          <Edit3 size={14} aria-hidden="true" /> Editar
                        </button>
                        {conta.codigo_barras && (
                          <button type="button" role="menuitem" onClick={() => { setMenuOpenId(null); handleCopy(conta.codigo_barras!, conta.id); }}>
                            {copiedId === conta.id ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copiedId === conta.id ? "Copiado!" : "Copiar código"}
                          </button>
                        )}
                        {isPago && (
                          <button type="button" role="menuitem" onClick={() => { setMenuOpenId(null); handleLancarNoCaixa(conta); }}>
                            <ArrowUpRight size={14} aria-hidden="true" /> Lançar no caixa
                          </button>
                        )}
                        <button type="button" role="menuitem" className="danger" onClick={() => { setMenuOpenId(null); handleDelete(conta.id); }}>
                          <Trash2 size={14} aria-hidden="true" /> Excluir
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-conta-title"
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
              maxHeight: "min(90vh, 90dvh)",
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--sp-3)" }}>
              <div>
                <h2 id="modal-conta-title" className="h2">{editingConta ? "Editar Anotação de Conta" : "Nova Anotação de Conta a Pagar"}</h2>
                <p className="muted" style={{ fontSize: "var(--text-xs)", marginTop: 2 }}>
                  Preencha os dados, prazo, data de pagamento e nível de importância.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="btn btn-ghost"
                style={{ minWidth: 44, minHeight: 44, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                title="Fechar janela"
                aria-label="Fechar janela"
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
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-sql-title"
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
              maxHeight: "min(85vh, 85dvh)",
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--sp-3)" }}>
              <div>
                <h2 id="modal-sql-title" className="h2">Sincronização com o Supabase</h2>
                <p className="muted" style={{ fontSize: "var(--text-xs)" }}>
                  Execute este script no SQL Editor do seu Supabase para persistir suas contas na nuvem.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="btn btn-ghost"
                style={{ minWidth: 44, minHeight: 44, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                title="Fechar janela"
                aria-label="Fechar janela"
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
