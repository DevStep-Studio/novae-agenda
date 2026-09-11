"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useStore } from "@/store/store";
import type { ClientDTO } from "@/shared/types";
import { Search, UserPlus, UserCheck, ArrowLeft, Loader2, Phone, Mail } from "lucide-react";

export function ClientPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { clients, createClient, notify } = useStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientDTO[]>([]);
  const [selected, setSelected] = useState<ClientDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (value || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void api<ClientDTO[]>(`/api/clients?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then(setResults)
        .catch(e => {
          if (!controller.signal.aborted) notify(e.message, "error");
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, value, notify]);

  const client = clients.find(c => c.id === value) || selected;

  if (value) {
    return (
      <div className="client-picker-selected-card">
        <div className="client-picker-selected-left">
          <div className="client-picker-avatar">
            <UserCheck size={18} />
          </div>
          <div className="client-picker-selected-meta">
            <strong>{client?.name || "Cliente selecionado"}</strong>
            <div className="client-picker-submeta">
              {client?.phone && <span><Phone size={12} /> {client.phone}</span>}
              {client?.email && <span><Mail size={12} /> {client.email}</span>}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="link-button client-picker-change-btn"
          onClick={() => {
            onChange("");
            setSelected(null);
          }}
        >
          Trocar cliente
        </button>
      </div>
    );
  }

  return (
    <div className="client-picker">
      <div className="modal-input-wrap">
        <Search size={18} className="modal-input-icon" />
        <input
          className="input"
          aria-label="Buscar cliente por nome, telefone ou e-mail"
          placeholder="Nome, telefone ou e-mail..."
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setResults([]);
          }}
        />
      </div>

      {query.trim().length >= 2 && (
        <div className="client-search-results-list">
          {results.slice(0, 8).map(c => (
            <button
              type="button"
              className="client-search-result-item"
              key={c.id}
              onClick={() => {
                setSelected(c);
                onChange(c.id);
              }}
            >
              <div className="client-search-result-name">{c.name}</div>
              <div className="client-search-result-contact">
                {c.phone && <span>{c.phone}</span>}
                {c.email && <span>• {c.email}</span>}
              </div>
            </button>
          ))}
          {results.length === 0 && (
            <div className="client-search-no-results">
              Nenhum cliente encontrado para &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      )}

      {!creating && (
        <button
          type="button"
          className="link-button client-create-trigger"
          onClick={() => {
            setCreating(true);
            if (/^[+\d ()-]+$/.test(query)) setPhone(query);
            else setName(query);
          }}
        >
          <UserPlus size={14} /> Criar novo cliente
        </button>
      )}

      {creating && (
        <div className="inline-client-form-card">
          <div className="inline-client-form-title">
            <UserPlus size={15} /> Novo cliente
          </div>
          <div className="inline-client-form-grid">
            <label className="field">
              <span className="field-label">Nome *</span>
              <input
                className="input"
                placeholder="Nome completo"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Telefone *</span>
              <input
                className="input"
                type="tel"
                placeholder="(00) 00000-0000"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </label>
            <label className="field inline-client-full">
              <span className="field-label">E-mail (opcional)</span>
              <input
                className="input"
                type="email"
                placeholder="cliente@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </label>
          </div>
          <div className="inline-client-form-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy || name.trim().length < 2 || phone.replace(/\D/g, "").length < 8}
              onClick={async () => {
                setBusy(true);
                try {
                  const c = await createClient({ name: name.trim(), phone, email: email || undefined });
                  setSelected(c);
                  onChange(c.id);
                  setCreating(false);
                } catch (e) {
                  notify((e as Error).message, "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? <><Loader2 size={14} className="spin" /> Salvando...</> : "Salvar cliente"}
            </button>
            <button
              type="button"
              className="link-button"
              onClick={() => setCreating(false)}
            >
              <ArrowLeft size={13} /> Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
