"use client";

import { Fragment, useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatBRL } from "@/lib/utils/currency";
import type {
  Category,
  CategoriaRow,
  ImportanciaConta,
  FormaPagamentoConta,
  StatusConta,
  PagamentoConta,
} from "@/types/database";
import { mapCategoria } from "@/lib/data/mappers";
import { registrarPagamento, desfazerPagamento } from "@/lib/actions/contas-pagar";
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
  History,
  RotateCcw,
} from "lucide-react";

export type ContaPagarItem = {
  id: string;
  user_id: string;
  titulo: string;
  descricao: string | null;
  valor: number;
  valor_pago: number;
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

function parseCurrencyInput(raw: string): number {
  const cleaned = raw.trim().replace(/[^\d.,-]/g, "");
  if (!cleaned) return NaN;
  if (cleaned.includes(",")) {
    return Number(cleaned.replace(/\./g, "").replace(",", "."));
  }
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    return Number(parts.join(""));
  }
  return Number(cleaned);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeConta(c: any): ContaPagarItem {
  const valor = Number(c.valor ?? 0);
  const valorPago = Number(c.valor_pago ?? (c.status === "pago" ? valor : 0));
  return {
    ...c,
    valor,
    valor_pago: valorPago,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePagamento(p: any): PagamentoConta {
  return {
    ...p,
    valor: Number(p.valor ?? 0),
  };
}

const brlCompact = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);

export default function ContasPagarPage() {
  const [contas, setContas] = useState<ContaPagarItem[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentoConta[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [usingLocalStorage, setUsingLocalStorage] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSqlModal, setShowSqlModal] = useState(false);

  // Filtros e expansão de histórico
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [expandedContaId, setExpandedContaId] = useState<string | null>(null);

  // Modal formulário de criação/edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConta, setEditingConta] = useState<ContaPagarItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Modal de pagamento parcial/total
  const [payingContaId, setPayingContaId] = useState<string | null>(null);
  const [payValor, setPayValor] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payError, setPayError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [undoingPaymentId, setUndoingPaymentId] = useState<string | null>(null);

  const todayIso = useMemo(() => localTodayIso(), []);

  // Form State
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    valor: "",
    prazo: todayIso,
    importancia: "media" as ImportanciaConta,
    categoria_id: "",
    codigo_barras: "",
    forma_pagamento: "boleto" as FormaPagamentoConta,
    recorrente: false,
    jaPaga: false,
    jaPagaData: todayIso,
  });

  const fetchContasAndPagamentos = useCallback(async (uid: string): Promise<ContaPagarItem[]> => {
    const supabase = createClient();
    const [contasRes, pagamentosRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("contas_pagar")
        .select("*")
        .eq("user_id", uid)
        .order("prazo", { ascending: true }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("pagamentos_conta")
        .select("*")
        .eq("user_id", uid)
        .order("pago_em", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    if (contasRes.error) {
      throw contasRes.error;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const normalized = ((contasRes.data as any[]) ?? []).map(normalizeConta);
    setContas(normalized);
    if (!pagamentosRes.error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setPagamentos(((pagamentosRes.data as any[]) ?? []).map(normalizePagamento));
    }
    return normalized;
  }, []);

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

        // Carrega contas e pagamentos em paralelo
        const [contasRes, pagamentosRes] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any)
            .from("contas_pagar")
            .select("*")
            .eq("user_id", user.id)
            .order("prazo", { ascending: true }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any)
            .from("pagamentos_conta")
            .select("*")
            .eq("user_id", user.id)
            .order("pago_em", { ascending: false })
            .order("created_at", { ascending: false }),
        ]);

        if (contasRes.error) {
          // Se a tabela ainda não existir no Supabase, usa localStorage de forma transparente
          console.warn("Supabase contas_pagar não encontrada ou sem permissão. Usando armazenamento local.", contasRes.error);
          setUsingLocalStorage(true);
          const localData = localStorage.getItem(`${STORAGE_KEY_PREFIX}${user.id}`);
          if (localData) {
            try {
              const parsed = JSON.parse(localData);
              setContas(Array.isArray(parsed) ? parsed.map(normalizeConta) : []);
            } catch {
              setContas([]);
            }
          }
        } else {
          setUsingLocalStorage(false);
          const contasData = contasRes.data ?? [];
          // Se o banco na nuvem acabou de ser criado e está vazio, mas o usuário tinha anotações locais, migra automaticamente
          const localData = localStorage.getItem(`${STORAGE_KEY_PREFIX}${user.id}`);
          if (contasData.length === 0 && localData) {
            try {
              const parsedLocal: ContaPagarItem[] = JSON.parse(localData);
              if (parsedLocal.length > 0) {
                for (const item of parsedLocal) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const { data: inserted, error: insertError } = await (supabase as any)
                    .from("contas_pagar")
                    .insert({
                      user_id: user.id,
                      titulo: item.titulo,
                      descricao: item.descricao,
                      valor: Number(item.valor ?? 0),
                      prazo: item.prazo,
                      importancia: item.importancia,
                      status: "pendente",
                      categoria_id: item.categoria_id,
                      codigo_barras: item.codigo_barras,
                      forma_pagamento: item.forma_pagamento,
                      recorrente: item.recorrente,
                    })
                    .select("id")
                    .single();

                  if (!insertError && inserted?.id && item.status === "pago" && Number(item.valor) > 0) {
                    await registrarPagamento(
                      inserted.id,
                      Number(item.valor),
                      item.data_pagamento || todayIso
                    );
                  }
                }
                localStorage.removeItem(`${STORAGE_KEY_PREFIX}${user.id}`);
                await fetchContasAndPagamentos(user.id);
              } else {
                setContas([]);
                setPagamentos([]);
              }
            } catch (migErr) {
              console.warn("Erro ao migrar dados locais:", migErr);
            }
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setContas((contasData as any[]).map(normalizeConta));
            if (!pagamentosRes.error) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              setPagamentos(((pagamentosRes.data as any[]) ?? []).map(normalizePagamento));
            }
          }
        }
      } catch (err) {
        console.error("Erro geral ao carregar dados:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [fetchContasAndPagamentos, todayIso]);

  const activePayingConta = useMemo(
    () => (payingContaId ? contas.find(c => c.id === payingContaId) ?? null : null),
    [payingContaId, contas]
  );

  // Trava scroll do body e fecha modais com Escape (acessibilidade WAI-ARIA)
  useEffect(() => {
    if (!isModalOpen && !showSqlModal && !payingContaId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsModalOpen(false);
        setShowSqlModal(false);
        setPayingContaId(null);
      }
    };
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isModalOpen, showSqlModal, payingContaId]);

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

  // Pagamentos agrupados por conta
  const pagamentosPorConta = useMemo(() => {
    const map: Record<string, PagamentoConta[]> = {};
    for (const p of pagamentos) {
      if (!map[p.conta_id]) map[p.conta_id] = [];
      map[p.conta_id].push(p);
    }
    return map;
  }, [pagamentos]);

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

  // Auxiliar para formatação de data sem UTC offset
  const formatIsoDate = (iso: string | null) => {
    if (!iso) return "-";
    const parts = iso.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return iso;
  };

  // Abrir modal de criação
  function handleOpenCreate() {
    setEditingConta(null);
    setFormError(null);
    setFormData({
      titulo: "",
      descricao: "",
      valor: "",
      prazo: todayIso,
      importancia: "media",
      categoria_id: "",
      codigo_barras: "",
      forma_pagamento: "boleto",
      recorrente: false,
      jaPaga: false,
      jaPagaData: todayIso,
    });
    setIsModalOpen(true);
  }

  // Abrir modal de edição
  function handleOpenEdit(conta: ContaPagarItem) {
    setEditingConta(conta);
    setFormError(null);
    setFormData({
      titulo: conta.titulo,
      descricao: conta.descricao ?? "",
      valor: conta.valor.toFixed(2).replace(".", ","),
      prazo: conta.prazo,
      importancia: conta.importancia,
      categoria_id: conta.categoria_id ?? "",
      codigo_barras: conta.codigo_barras ?? "",
      forma_pagamento: conta.forma_pagamento ?? "boleto",
      recorrente: conta.recorrente,
      jaPaga: false,
      jaPagaData: todayIso,
    });
    setIsModalOpen(true);
  }

  // Abrir modal de pagamento
  function handleOpenPayModal(conta: ContaPagarItem) {
    const restante = Math.max(0, Number((conta.valor - conta.valor_pago).toFixed(2)));
    setPayingContaId(conta.id);
    setPayValor(restante.toFixed(2).replace(".", ","));
    setPayDate(todayIso);
    setPayError(null);
  }

  // Confirmar pagamento via server action (sem atualização otimista de status/valor_pago)
  async function handleConfirmPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!activePayingConta || !userId) return;

    setPayError(null);
    const parsedValor = parseCurrencyInput(payValor);
    const roundedValor = Math.round(parsedValor * 100) / 100;

    if (!Number.isFinite(parsedValor) || roundedValor < 0.01) {
      setPayError("O valor do pagamento deve ser de pelo menos R$ 0,01.");
      return;
    }

    setIsPaying(true);
    try {
      const res = await registrarPagamento(activePayingConta.id, roundedValor, payDate || todayIso);
      if (!res.success) {
        setPayError(res.message || "Não foi possível registrar o pagamento.");
        return;
      }

      await fetchContasAndPagamentos(userId);
      setPayingContaId(null);
      showFeedback("Pagamento registrado com sucesso!");
    } catch (err) {
      console.error("Erro ao registrar pagamento:", err);
      setPayError("Erro inesperado ao registrar o pagamento.");
    } finally {
      setIsPaying(false);
    }
  }

  // Desfazer pagamento via server action com confirmação
  async function handleUndoPayment(pagamento: PagamentoConta) {
    if (!userId) return;
    if (
      !confirm(
        `Tem certeza que deseja desfazer o pagamento de ${formatBRL(pagamento.valor)} realizado em ${formatIsoDate(pagamento.pago_em)}?`
      )
    ) {
      return;
    }

    setUndoingPaymentId(pagamento.id);
    setPayError(null);
    try {
      const res = await desfazerPagamento(pagamento.id);
      if (!res.success) {
        const msg = res.message || "Não foi possível desfazer o pagamento.";
        if (payingContaId) setPayError(msg);
        showFeedback(msg, "error");
        return;
      }

      const refreshed = await fetchContasAndPagamentos(userId);

      // Se o modal de pagamento dessa conta estiver aberto, atualiza o valor padrão para o novo restante
      if (payingContaId === pagamento.conta_id) {
        const updatedConta = refreshed.find(c => c.id === pagamento.conta_id);
        if (updatedConta) {
          const novoRestante = Math.max(0, Number((updatedConta.valor - updatedConta.valor_pago).toFixed(2)));
          setPayValor(novoRestante.toFixed(2).replace(".", ","));
        }
      }

      showFeedback("Pagamento desfeito com sucesso.");
    } catch (err) {
      console.error("Erro ao desfazer pagamento:", err);
      showFeedback("Erro inesperado ao desfazer o pagamento.", "error");
    } finally {
      setUndoingPaymentId(null);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("contas_pagar").delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;
      await fetchContasAndPagamentos(userId);
      showFeedback("Anotação excluída com sucesso.");
    } catch (err) {
      console.warn("Erro ao deletar no Supabase:", err);
      showFeedback("Não foi possível excluir a conta.", "error");
      await fetchContasAndPagamentos(userId).catch(() => {});
    }
  }

  // Salvar (Criar ou Editar)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!formData.titulo.trim()) {
      setFormError("Informe o título da conta.");
      return;
    }

    const parsedValor = parseCurrencyInput(formData.valor);
    const roundedValor = Math.round(parsedValor * 100) / 100;
    if (!Number.isFinite(parsedValor) || roundedValor <= 0) {
      setFormError("Informe um valor válido maior que zero.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingConta) {
        if (!usingLocalStorage && userId) {
          const supabase = createClient();
          // Edição NUNCA envia status, valor_pago nem data_pagamento
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase as any)
            .from("contas_pagar")
            .update({
              titulo: formData.titulo.trim(),
              descricao: formData.descricao.trim() || null,
              valor: roundedValor,
              prazo: formData.prazo,
              importancia: formData.importancia,
              categoria_id: formData.categoria_id || null,
              codigo_barras: formData.codigo_barras.trim() || null,
              forma_pagamento: formData.forma_pagamento,
              recorrente: formData.recorrente,
            })
            .eq("id", editingConta.id)
            .eq("user_id", userId);

          if (error) {
            const msg = String(error.message || "");
            if (msg.includes("contas_pagar_valor_pago_check") || msg.toLowerCase().includes("valor_pago")) {
              setFormError(
                `O valor da conta não pode ser menor que o valor já pago (${formatBRL(editingConta.valor_pago)}).`
              );
            } else {
              setFormError(msg || "Não foi possível atualizar a conta.");
            }
            return;
          }

          await fetchContasAndPagamentos(userId);
          showFeedback("Conta atualizada com sucesso!");
          setIsModalOpen(false);
        } else {
          const updated: ContaPagarItem = {
            ...editingConta,
            titulo: formData.titulo.trim(),
            descricao: formData.descricao.trim() || null,
            valor: roundedValor,
            prazo: formData.prazo,
            importancia: formData.importancia,
            categoria_id: formData.categoria_id || null,
            codigo_barras: formData.codigo_barras.trim() || null,
            forma_pagamento: formData.forma_pagamento,
            recorrente: formData.recorrente,
          };
          const newContas = contas.map(c => (c.id === editingConta.id ? updated : c));
          setContas(newContas);
          persistLocal(newContas);
          showFeedback("Conta atualizada com sucesso!");
          setIsModalOpen(false);
        }
      } else {
        // Criação: sempre com status 'pendente'
        const newId =
          typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `conta-${Date.now()}`;

        if (!usingLocalStorage && userId) {
          const supabase = createClient();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase as any).from("contas_pagar").insert({
            id: newId,
            user_id: userId,
            titulo: formData.titulo.trim(),
            descricao: formData.descricao.trim() || null,
            valor: roundedValor,
            prazo: formData.prazo,
            importancia: formData.importancia,
            status: "pendente",
            categoria_id: formData.categoria_id || null,
            codigo_barras: formData.codigo_barras.trim() || null,
            forma_pagamento: formData.forma_pagamento,
            recorrente: formData.recorrente,
          });

          if (error) {
            setFormError(error.message || "Não foi possível registrar a nova conta.");
            return;
          }

          if (formData.jaPaga) {
            const payRes = await registrarPagamento(newId, roundedValor, formData.jaPagaData || todayIso);
            if (!payRes.success) {
              await fetchContasAndPagamentos(userId);
              setFormError(
                `A conta foi criada, mas não foi possível registrar o pagamento: ${payRes.message || "Erro desconhecido."}`
              );
              return;
            }
          }

          await fetchContasAndPagamentos(userId);
          showFeedback(
            formData.jaPaga ? "Conta registrada e marcada como paga!" : "Nova conta registrada com sucesso!"
          );
          setIsModalOpen(false);
        } else {
          const newItem: ContaPagarItem = {
            id: newId,
            user_id: userId ?? "offline",
            titulo: formData.titulo.trim(),
            descricao: formData.descricao.trim() || null,
            valor: roundedValor,
            valor_pago: formData.jaPaga ? roundedValor : 0,
            prazo: formData.prazo,
            data_pagamento: formData.jaPaga ? formData.jaPagaData || todayIso : null,
            importancia: formData.importancia,
            status: formData.jaPaga ? "pago" : "pendente",
            categoria_id: formData.categoria_id || null,
            codigo_barras: formData.codigo_barras.trim() || null,
            forma_pagamento: formData.forma_pagamento,
            recorrente: formData.recorrente,
            created_at: new Date().toISOString(),
          };
          const newContas = [newItem, ...contas];
          setContas(newContas);
          persistLocal(newContas);
          showFeedback("Nova conta registrada com sucesso!");
          setIsModalOpen(false);
        }
      }
    } catch (err) {
      console.error("Erro ao salvar conta:", err);
      setFormError("Erro inesperado ao salvar a conta. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Copiar código de barras ou PIX
  function handleCopy(codigo: string, id: string) {
    if (!codigo) return;
    navigator.clipboard.writeText(codigo);
    setCopiedId(id);
    showFeedback("Código copiado para a área de transferência!");
    setTimeout(() => setCopiedId(null), 2500);
  }

  // Registrar lançamento manual no livro-caixa apenas quando status === 'pago', usando valor_pago
  async function handleLancarNoCaixa(conta: ContaPagarItem) {
    if (!userId || conta.status !== "pago") return;
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("transacoes").insert({
        user_id: userId,
        descricao: `[Conta Paga] ${conta.titulo}`,
        valor: conta.valor_pago,
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
    let countPagas = 0;
    let countProximos7Dias = 0;
    let totalProximos7Dias = 0;

    contas.forEach(c => {
      totalPago += c.valor_pago;

      if (c.status === "pago") {
        countPagas++;
      } else {
        const restante = Math.max(0, c.valor - c.valor_pago);
        totalPendente += restante;
        if (c.prazo < todayIso) {
          totalAtrasado += restante;
          countAtrasadas++;
        } else if (dayDiff(c.prazo, todayIso) <= 7) {
          totalProximos7Dias += restante;
          countProximos7Dias++;
        }
      }
    });

    return {
      totalPendente,
      totalPago,
      totalAtrasado,
      countAtrasadas,
      countPagas,
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

  // Lista filtrada e ordenada: pendentes/parciais primeiro (prazo mais próximo no topo), pagas por último
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
          aria-label="Total pago"
          onClick={() => setStatusFilter(s => (s === "pagas" ? "todas" : "pagas"))}
        >
          <div className="metric-top">
            <span className="metric-label">
              <span className="only-d">Total Pago</span>
              <span className="only-m">Pago</span>
            </span>
            <CircleCheck size={18} color="var(--color-success)" className="only-d" aria-hidden="true" />
          </div>
          <div className="metric-bottom">
            <span className="num metric-value" style={{ color: "var(--color-success)" }}>
              <span className="only-d">{formatBRL(metrics.totalPago)}</span>
              <span className="only-m">{brlCompact(metrics.totalPago)}</span>
            </span>
            <span className="count-badge only-d" style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
              {metrics.countPagas} {metrics.countPagas === 1 ? "quitada" : "quitadas"}
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

            {filteredContas.map((conta, idx) => {
              const isPago = conta.status === "pago";
              const isParcial = conta.status === "parcial";
              const diff = dayDiff(conta.prazo, todayIso);
              const isAtrasada = !isPago && diff < 0;

              const statusBadge = isPago
                ? { label: "Pago", color: "var(--color-success)", bg: "var(--color-success-bg)" }
                : isParcial
                  ? { label: "Parcial", color: "var(--color-primary)", bg: "color-mix(in srgb, var(--color-primary) 14%, transparent)" }
                  : { label: "Pendente", color: "var(--color-warning)", bg: "var(--color-warning-bg)" };

              const iconColor = isPago
                ? "var(--color-success)"
                : isAtrasada
                  ? "var(--color-danger)"
                  : isParcial
                    ? "var(--color-primary)"
                    : "var(--color-warning)";

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

              const contaPagamentos = pagamentosPorConta[conta.id] ?? [];
              const isExpanded = expandedContaId === conta.id;
              const pctPago = conta.valor > 0 ? Math.min(100, Math.max(0, (conta.valor_pago / conta.valor) * 100)) : 0;
              const restante = Math.max(0, conta.valor - conta.valor_pago);
              const isLastRow = idx === filteredContas.length - 1;

              return (
                <Fragment key={conta.id}>
                  <div
                    className="table-row"
                    style={{
                      paddingTop: isParcial ? 10 : undefined,
                      paddingBottom: isParcial ? 10 : undefined,
                      borderBottom: isExpanded ? "none" : undefined,
                    }}
                  >
                    <div className="bill-cell-main">
                      <span className="bill-icon" aria-hidden="true">
                        <FileText size={14} color={iconColor} />
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

                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                      <span className="count-badge" style={{ background: statusBadge.bg, color: statusBadge.color, display: "inline-block" }}>
                        {statusBadge.label}
                      </span>
                      {isAtrasada && (
                        <span className="count-badge" style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)", display: "inline-block" }}>
                          Vencida
                        </span>
                      )}
                    </div>

                    <div className="num" style={{ textAlign: "left" }}>
                      {isParcial ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                          <span style={{ fontSize: "var(--text-xs)", fontWeight: "var(--weight-strong)", color: "var(--color-text)", whiteSpace: "nowrap" }}>
                            {formatBRL(conta.valor_pago)} / {formatBRL(conta.valor)}
                          </span>
                          <div
                            className="meter"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(pctPago)}
                            aria-label={`${Math.round(pctPago)}% pago`}
                            style={{ width: "100%", maxWidth: 150 }}
                          >
                            <span style={{ width: `${pctPago}%` }} />
                          </div>
                          <span style={{ fontSize: 11, color: "var(--color-text-3)" }}>
                            Resta {formatBRL(restante)}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-strong)", color: isPago ? "var(--color-text-3)" : "var(--color-text)" }}>
                          {formatBRL(conta.valor)}
                        </span>
                      )}
                    </div>

                    <div className="bill-actions" data-row-menu>
                      {isPago ? (
                        <span
                          className="btn-paid"
                          style={{ cursor: "default" }}
                          aria-label={`${conta.titulo}: paga`}
                        >
                          Paga <Check size={12} aria-hidden="true" />
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn-pay"
                          onClick={() => handleOpenPayModal(conta)}
                          aria-label={`Registrar pagamento de ${conta.titulo}`}
                        >
                          <Check size={12} aria-hidden="true" /> Pagar
                        </button>
                      )}

                      {contaPagamentos.length > 0 && (
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => setExpandedContaId(isExpanded ? null : conta.id)}
                          aria-expanded={isExpanded}
                          aria-label={`Histórico de pagamentos de ${conta.titulo}`}
                          title="Histórico de pagamentos"
                          style={{
                            color: isExpanded ? "var(--color-primary)" : undefined,
                            background: isExpanded ? "var(--color-surface-2)" : undefined,
                          }}
                        >
                          <History size={15} aria-hidden="true" />
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
                          {contaPagamentos.length > 0 && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setMenuOpenId(null);
                                setExpandedContaId(isExpanded ? null : conta.id);
                              }}
                            >
                              <History size={14} aria-hidden="true" />
                              {isExpanded ? "Ocultar pagamentos" : `Pagamentos (${contaPagamentos.length})`}
                            </button>
                          )}
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

                  {/* HISTÓRICO EXPANSÍVEL DE PAGAMENTOS DA CONTA */}
                  {isExpanded && (
                    <div
                      style={{
                        background: "var(--color-bg)",
                        padding: "12px 20px",
                        borderTop: "1px dashed var(--color-border)",
                        borderBottom: isLastRow ? "none" : "1px solid var(--color-border)",
                        borderRadius: isLastRow ? "0 0 var(--radius-md) var(--radius-md)" : undefined,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span className="eyebrow" style={{ fontSize: 11 }}>
                          Histórico de pagamentos ({contaPagamentos.length})
                        </span>
                        <span className="muted num" style={{ fontSize: "var(--text-xs)" }}>
                          Pago: {formatBRL(conta.valor_pago)} · Restante: {formatBRL(restante)}
                        </span>
                      </div>

                      {contaPagamentos.length === 0 ? (
                        <p className="muted" style={{ fontSize: "var(--text-xs)" }}>
                          Nenhum pagamento registrado para esta conta.
                        </p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {contaPagamentos.map(pag => (
                            <div
                              key={pag.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12,
                                padding: "8px 12px",
                                background: "var(--color-surface)",
                                border: "1px solid var(--color-border)",
                                borderRadius: "var(--radius-sm)",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                                <span className="muted" style={{ fontSize: "var(--text-xs)" }}>
                                  {formatIsoDate(pag.pago_em)}
                                </span>
                                <span className="num" style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-strong)", color: "var(--color-success)" }}>
                                  {formatBRL(pag.valor)}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => handleUndoPayment(pag)}
                                disabled={undoingPaymentId === pag.id}
                                style={{ height: 30, minHeight: 30, padding: "0 10px", fontSize: "var(--text-xs)", color: "var(--color-danger)" }}
                              >
                                <RotateCcw size={12} aria-hidden="true" />
                                {undoingPaymentId === pag.id ? "Desfazendo..." : "Desfazer"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        )}
      </section>

      {/* MODAL DE REGISTRAR PAGAMENTO */}
      {activePayingConta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-pagar-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10, 14, 23, 0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 910,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--sp-4)",
          }}
          onClick={e => {
            if (e.target === e.currentTarget && !isPaying) setPayingContaId(null);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--sp-3)" }}>
              <div>
                <h2 id="modal-pagar-title" className="h2">Registrar Pagamento</h2>
                <p className="muted" style={{ fontSize: "var(--text-xs)", marginTop: 2 }}>
                  {activePayingConta.titulo}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayingContaId(null)}
                disabled={isPaying}
                className="btn btn-ghost"
                style={{ minWidth: 44, minHeight: 44, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                title="Fechar janela"
                aria-label="Fechar janela"
              >
                <X size={18} />
              </button>
            </div>

            {(() => {
              const restante = Math.max(0, Number((activePayingConta.valor - activePayingConta.valor_pago).toFixed(2)));
              const historico = pagamentosPorConta[activePayingConta.id] ?? [];

              return (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: "var(--sp-2)",
                      padding: "var(--sp-3)",
                      background: "var(--color-surface-2)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    <div>
                      <div className="muted" style={{ fontSize: 11 }}>Total</div>
                      <div className="num" style={{ textAlign: "left", fontSize: "var(--text-sm)", fontWeight: "var(--weight-strong)" }}>
                        {formatBRL(activePayingConta.valor)}
                      </div>
                    </div>
                    <div>
                      <div className="muted" style={{ fontSize: 11 }}>Já pago</div>
                      <div className="num" style={{ textAlign: "left", fontSize: "var(--text-sm)", fontWeight: "var(--weight-strong)", color: "var(--color-success)" }}>
                        {formatBRL(activePayingConta.valor_pago)}
                      </div>
                    </div>
                    <div>
                      <div className="muted" style={{ fontSize: 11 }}>Restante</div>
                      <div className="num" style={{ textAlign: "left", fontSize: "var(--text-sm)", fontWeight: "var(--weight-strong)", color: "var(--color-warning)" }}>
                        {formatBRL(restante)}
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleConfirmPayment} className="form" noValidate>
                    <div className="field-row">
                      <div className="field">
                        <label htmlFor="pay-valor-input" className="label">Valor do Pagamento (R$)*</label>
                        <input
                          id="pay-valor-input"
                          type="text"
                          inputMode="decimal"
                          required
                          placeholder="0,00"
                          value={payValor}
                          onChange={e => {
                            setPayValor(e.target.value);
                            if (payError) setPayError(null);
                          }}
                          className="input"
                          autoFocus
                        />
                        <span className="hint">
                          Mínimo R$ 0,01 · Máximo {formatBRL(restante)}
                        </span>
                      </div>

                      <div className="field">
                        <label htmlFor="pay-date-input" className="label">Data do Pagamento*</label>
                        <input
                          id="pay-date-input"
                          type="date"
                          required
                          value={payDate}
                          onChange={e => {
                            setPayDate(e.target.value);
                            if (payError) setPayError(null);
                          }}
                          className="input"
                        />
                      </div>
                    </div>

                    {payError && (
                      <div
                        role="alert"
                        style={{
                          padding: "10px 12px",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--color-danger-bg)",
                          color: "var(--color-danger)",
                          border: "1px solid var(--color-danger)",
                          fontSize: "var(--text-xs)",
                          fontWeight: "var(--weight-medium)",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <AlertTriangle size={14} style={{ flexShrink: 0 }} aria-hidden="true" />
                        <span>{payError}</span>
                      </div>
                    )}

                    <div className="form-actions">
                      <button
                        type="button"
                        onClick={() => setPayingContaId(null)}
                        className="btn btn-ghost"
                        disabled={isPaying}
                      >
                        Cancelar
                      </button>
                      <button type="submit" className="btn btn-primary" disabled={isPaying}>
                        {isPaying ? "Registrando..." : "Confirmar Pagamento"}
                      </button>
                    </div>
                  </form>

                  {historico.length > 0 && (
                    <div
                      style={{
                        borderTop: "1px solid var(--color-border)",
                        paddingTop: "var(--sp-4)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <span className="eyebrow" style={{ fontSize: 11 }}>
                        Pagamentos anteriores ({historico.length})
                      </span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {historico.map(pag => (
                          <div
                            key={pag.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                              padding: "8px 10px",
                              background: "var(--color-surface-2)",
                              border: "1px solid var(--color-border)",
                              borderRadius: "var(--radius-sm)",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span className="muted" style={{ fontSize: "var(--text-xs)" }}>
                                {formatIsoDate(pag.pago_em)}
                              </span>
                              <span className="num" style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-strong)", color: "var(--color-success)" }}>
                                {formatBRL(pag.valor)}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => handleUndoPayment(pag)}
                              disabled={undoingPaymentId === pag.id || isPaying}
                              style={{ height: 28, minHeight: 28, padding: "0 8px", fontSize: "var(--text-xs)", color: "var(--color-danger)" }}
                            >
                              <RotateCcw size={12} aria-hidden="true" />
                              {undoingPaymentId === pag.id ? "Desfazendo..." : "Desfazer"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

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
                  Preencha os dados, prazo e nível de importância da conta.
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
                    onChange={e => {
                      setFormData(f => ({ ...f, valor: e.target.value }));
                      if (formError) setFormError(null);
                    }}
                    className="input"
                  />
                  {editingConta && editingConta.valor_pago > 0 && (
                    <span className="hint">Já pago: {formatBRL(editingConta.valor_pago)}</span>
                  )}
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

              {/* Prazo (Vencimento) e Forma de Pagamento */}
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

              {/* Checkbox "Já paga" apenas na criação */}
              {!editingConta && (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={formData.jaPaga}
                      onChange={e => setFormData(f => ({ ...f, jaPaga: e.target.checked }))}
                    />
                    <span style={{ fontSize: "var(--text-sm)" }}>Já paga (registrar pagamento total ao criar)</span>
                  </label>

                  {formData.jaPaga && (
                    <div className="field">
                      <label className="label">Data do Pagamento*</label>
                      <input
                        type="date"
                        required
                        value={formData.jaPagaData}
                        onChange={e => setFormData(f => ({ ...f, jaPagaData: e.target.value }))}
                        className="input"
                      />
                    </div>
                  )}
                </div>
              )}

              {formError && (
                <div
                  role="alert"
                  style={{
                    padding: "10px 12px",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--color-danger-bg)",
                    color: "var(--color-danger)",
                    border: "1px solid var(--color-danger)",
                    fontSize: "var(--text-xs)",
                    fontWeight: "var(--weight-medium)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <AlertTriangle size={14} style={{ flexShrink: 0 }} aria-hidden="true" />
                  <span>{formError}</span>
                </div>
              )}

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
