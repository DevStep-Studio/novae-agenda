"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useStore } from "@/store/store";
import type { ClientDTO } from "@/shared/types";
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
    const timer = setTimeout(() => { void api<ClientDTO[]>(`/api/clients?q=${encodeURIComponent(query)}`, { signal: controller.signal }).then(setResults).catch(e => { if (!controller.signal.aborted) notify(e.message, "error"); }); }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, value, notify]);
  const client = clients.find(c => c.id === value) || selected;
  if (value) return <div className="quick-actions"><strong>{client?.name || "Cliente selecionado"}</strong><button type="button" className="link-button" onClick={() => { onChange(""); setSelected(null); }}>Trocar cliente</button></div>;
  return <div className="client-picker">
    <input className="input" aria-label="Buscar cliente por nome, telefone ou e-mail" placeholder="Nome, telefone ou e-mail" value={query} onChange={e => { setQuery(e.target.value); setResults([]); }} />
    {query.trim().length >= 2 && results.slice(0, 8).map(c => <button type="button" className="client-search-result" key={c.id} onClick={() => { setSelected(c); onChange(c.id); }}><strong>{c.name}</strong><span>{c.phone} {c.email}</span></button>)}
    {!creating && <button type="button" className="link-button" onClick={() => { setCreating(true); if (/^[+\d ()-]+$/.test(query)) setPhone(query); else setName(query); }}>+ Criar cliente</button>}
    {creating && <div className="inline-client-form">
      <label>Nome<input className="input" value={name} onChange={e => setName(e.target.value)} /></label>
      <label>Telefone<input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} /></label>
      <label>E-mail (opcional)<input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <button type="button" className="btn btn-secondary" disabled={busy || name.trim().length < 2 || phone.replace(/\D/g, "").length < 8} onClick={async () => {
        setBusy(true);
        try { const c = await createClient({ name: name.trim(), phone, email: email || undefined }); setSelected(c); onChange(c.id); setCreating(false); }
        catch (e) { notify((e as Error).message, "error"); }
        finally { setBusy(false); }
      }}>{busy ? "Salvando…" : "Salvar cliente e continuar"}</button>
      <button type="button" className="link-button" onClick={() => setCreating(false)}>Voltar à busca</button>
    </div>}
  </div>;
}
