"use client";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteTransaction } from "@/lib/actions/transactions";

export default function DeleteTransactionButton({ id, description }: { id: string; description: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleDelete() {
    if (!window.confirm(`Excluir o lançamento "${description}"? Esta ação não pode ser desfeita.`)) return;
    setError("");
    startTransition(async () => {
      const result = await deleteTransaction(id);
      if (result.success) {
        router.refresh();
      } else {
        const msg = result.message ?? "Erro ao excluir lançamento.";
        setError(msg);
        window.alert(msg);
      }
    });
  }

  return (
    <button
      type="button" className="icon-btn" onClick={handleDelete} disabled={isPending}
      aria-label={`Excluir ${description}`} title={error || "Excluir"}
    >
      <Trash2 size={16} aria-hidden="true" />
    </button>
  );
}