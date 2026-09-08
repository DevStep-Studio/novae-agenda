"use client";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import { useStore } from "@/store/store";
import type { ServiceDTO } from "@/shared/types";
import { b, ErrorMessage } from "./primitives";
export function ServiceEditor({
  service,
  onDone,
}: {
  service?: ServiceDTO;
  onDone: () => void;
}) {
  const { employees, categories, reloadServices, reloadEmployees, notify } =
    useStore();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [category, setCategory] = useState(service?.categoryId ?? ""),
    [extraCategories, setExtraCategories] = useState<
      Array<{ id: string; name: string }>
    >([]),
    [newCategory, setNewCategory] = useState(""),
    [ids, setIds] = useState(
      employees
        .filter((e) => e.serviceIds.includes(service?.id ?? ""))
        .map((e) => e.id),
    );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await api(service ? `/api/services/${service.id}` : "/api/services", {
        method: service ? "PATCH" : "POST",
        body: JSON.stringify({
          name: f.get("name"),
          price: Number(f.get("price")),
          durationMinutes: Number(f.get("duration")),
          description: f.get("description"),
          categoryId: category || null,
          employeeIds: ids,
          bufferMinutes: Number(f.get("buffer")),
          imageUrl: f.get("image"),
          deliveryMode: f.get("mode"),
          paymentType: f.get("payment"),
          depositAmount: Number(f.get("deposit")),
          cancellationPolicy: f.get("policy"),
        }),
      });
      await Promise.all([reloadServices(), reloadEmployees()]);
      notify(service ? "Serviço atualizado." : "Serviço cadastrado.");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={b.page}
      style={{ minHeight: 0, padding: 20, borderRadius: 12 }}
    >
      <form onSubmit={submit}>
        <ErrorMessage message={error} />
        <label className={b.field}>
          Nome do serviço
          <input
            name="name"
            required
            minLength={2}
            defaultValue={service?.name}
          />
        </label>
        <div className={b.grid2}>
          <label className={b.field}>
            Preço (R$)
            <input
              name="price"
              type="number"
              step="0.01"
              min={0}
              required
              defaultValue={service?.price}
            />
          </label>
          <label className={b.field}>
            Duração em minutos
            <input
              name="duration"
              type="number"
              min={5}
              max={1440}
              step={1}
              required
              defaultValue={service?.durationMinutes ?? 60}
            />
          </label>
          <label className={b.field}>
            Intervalo após atendimento (min)
            <input
              name="buffer"
              type="number"
              min={0}
              max={180}
              step={1}
              defaultValue={service?.bufferMinutes ?? 0}
            />
          </label>
          <label className={b.field}>
            Categoria
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Outros</option>
              {[
                ...categories,
                ...extraCategories.filter(
                  (c) => !categories.some((x) => x.id === c.id),
                ),
              ].map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={b.inline}>
          <input
            aria-label="Nova categoria"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Criar categoria"
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className={`${b.button} ${b.outline}`}
            disabled={newCategory.trim().length < 2 || busy}
            onClick={async () => {
              setBusy(true);
              try {
                const c = await api<{ id: string; name: string }>(
                  "/api/categories",
                  {
                    method: "POST",
                    body: JSON.stringify({ name: newCategory }),
                  },
                );
                setExtraCategories([...extraCategories, c]);
                setCategory(c.id);
                setNewCategory("");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Adicionar
          </button>
        </div>
        <label className={b.field} style={{ marginTop: 18 }}>
          Descrição
          <textarea
            name="description"
            defaultValue={service?.description ?? ""}
          />
        </label>
        <label className={b.field}>
          Imagem (URL)
          <input
            name="image"
            defaultValue={service?.imageUrl ?? ""}
            placeholder="https://…"
          />
        </label>
        <fieldset
          style={{
            border: "1px solid #e1e7e2",
            borderRadius: 9,
            padding: 14,
            marginBottom: 20,
          }}
        >
          <legend>Profissionais que realizam</legend>
          {employees
            .filter((e) => e.active)
            .map((e) => (
              <label key={e.id} className={b.check}>
                <input
                  type="checkbox"
                  checked={ids.includes(e.id)}
                  onChange={(event) =>
                    setIds(
                      event.target.checked
                        ? [...ids, e.id]
                        : ids.filter((id) => id !== e.id),
                    )
                  }
                />
                {e.name}
              </label>
            ))}
          {!employees.length && (
            <p className={b.muted}>
              Cadastre sua equipe para disponibilizar este serviço no link.
            </p>
          )}
        </fieldset>
        <div className={b.grid2}>
          <label className={b.field}>
            Atendimento
            <select
              name="mode"
              defaultValue={service?.deliveryMode ?? "IN_PERSON"}
            >
              <option value="IN_PERSON">Presencial</option>
              <option value="ONLINE">Online</option>
            </select>
          </label>
          <label className={b.field}>
            Pagamento
            <select
              name="payment"
              defaultValue={service?.paymentType ?? "PAY_LATER"}
            >
              <option value="PAY_LATER">No atendimento</option>
              <option value="FULL_PAYMENT">
                Antecipado (aguarda integração)
              </option>
              <option value="DEPOSIT">Sinal (aguarda integração)</option>
            </select>
          </label>
          <label className={b.field}>
            Valor do sinal (R$)
            <input
              name="deposit"
              type="number"
              min={0}
              step="0.01"
              defaultValue={service?.depositAmount ?? 0}
            />
          </label>
        </div>
        <p className={b.muted}>
          Serviços com pagamento antecipado ficam fora do catálogo público até
          que um gateway seja integrado.
        </p>
        <label className={b.field}>
          Informações de cancelamento
          <textarea
            name="policy"
            defaultValue={service?.cancellationPolicy ?? ""}
            maxLength={1000}
          />
        </label>
        <button className={`${b.button} ${b.wide}`} disabled={busy}>
          {busy ? "Salvando…" : "Salvar serviço"}
        </button>
      </form>
    </div>
  );
}
