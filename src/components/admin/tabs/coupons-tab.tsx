"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Ticket,
  Plus,
  Download,
  CheckCircle2,
  X,
  TrendingUp,
  Percent,
  DollarSign,
  UserCheck,
} from "lucide-react";
import { formatCurrency } from "@/lib/client-utils";
import styles from "../admin-dashboard.module.css";

export function CouponsTab() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // New Coupon Form
  const [newCouponForm, setNewCouponForm] = useState({
    code: "",
    name: "",
    description: "",
    influencerName: "",
    influencerContact: "",
    discountType: "PERCENTAGE",
    discountValue: 10,
    maxDiscountAmount: null as number | null,
    durationType: "ONCE",
    durationCycles: 1,
    commissionType: "NONE",
    commissionValue: 0,
    maxRedemptions: null as number | null,
    isActive: true,
  });

  // Export Filter Form
  const [exportForm, setExportForm] = useState({
    couponId: "",
    startDate: "",
    endDate: "",
  });

  const loadCoupons = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/superadmin/saas-coupons");
      const json = await res.json();
      if (json.data) {
        setCoupons(json.data);
      }
    } catch (err) {
      console.error("Error loading coupons:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCoupons();
  }, [loadCoupons]);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/superadmin/saas-coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCouponForm),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Erro ao criar cupom.");
        return;
      }
      alert("Cupom criado com sucesso!");
      setCreateModalOpen(false);
      setNewCouponForm({
        code: "",
        name: "",
        description: "",
        influencerName: "",
        influencerContact: "",
        discountType: "PERCENTAGE",
        discountValue: 10,
        maxDiscountAmount: null,
        durationType: "ONCE",
        durationCycles: 1,
        commissionType: "NONE",
        commissionValue: 0,
        maxRedemptions: null,
        isActive: true,
      });
      void loadCoupons();
    } catch (err: any) {
      alert("Erro ao criar cupom: " + err.message);
    }
  };

  const handleTriggerExport = () => {
    const params = new URLSearchParams();
    if (exportForm.couponId) params.set("couponId", exportForm.couponId);
    if (exportForm.startDate) params.set("startDate", exportForm.startDate);
    if (exportForm.endDate) params.set("endDate", exportForm.endDate);

    window.open(`/api/superadmin/saas-coupons/export?${params.toString()}`, "_blank");
    setExportModalOpen(false);
  };

  return (
    <div>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Ticket size={18} color="#818cf8" />
            Cupons & Parcerias com Influenciadores
          </h2>
        </div>

        <div className={styles.toolbarRight}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setExportModalOpen(true)}
          >
            <Download size={15} />
            Exportar CSV de Resgates
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus size={15} />
            Novo Cupom de Influenciador
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Código / Nome</th>
              <th>Influenciador & Contato</th>
              <th>Desconto</th>
              <th>Comissão</th>
              <th>Resgates</th>
              <th>Conversão em Pagamento</th>
              <th>Receita Gerada</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id}>
                <td>
                  <div style={{ fontWeight: 700, color: "#818cf8", fontSize: 14 }}>{c.code}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{c.name}</div>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{c.influencerName || "—"}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {c.influencerContact || "Sem contato informado"}
                  </div>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>
                    {c.discountType === "PERCENTAGE" ? `${c.discountValue}% OFF` : `R$ ${c.discountValue} OFF`}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    {c.durationType === "FOREVER"
                      ? "Vitalício"
                      : c.durationType === "LIMITED_CYCLES"
                      ? `${c.durationCycles} ciclos`
                      : "Primeira cobrança"}
                  </div>
                </td>
                <td>
                  {c.commissionType === "PERCENTAGE" ? (
                    <span style={{ color: "#fbbf24", fontWeight: 600 }}>{c.commissionValue}% por venda</span>
                  ) : c.commissionType === "FIXED" ? (
                    <span style={{ color: "#fbbf24", fontWeight: 600 }}>R$ {c.commissionValue} por venda</span>
                  ) : (
                    <span style={{ color: "var(--text-secondary)" }}>Sem comissão</span>
                  )}
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{c.totalUses} resgates</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    {c.maxRedemptions ? `Limite: ${c.maxRedemptions}` : "Sem limite"}
                  </div>
                </td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className={`${styles.statusPill} ${styles.statusActive}`}>
                      {c.conversionRate}% taxa
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      ({c.convertedUses} assinantes)
                    </span>
                  </div>
                </td>
                <td>
                  <div style={{ fontWeight: 600, color: "#10b981" }}>
                    {formatCurrency(c.totalRevenueGenerated)}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    Desconto: {formatCurrency(c.totalDiscountGiven)}
                  </div>
                </td>
                <td>
                  <span className={`${styles.statusPill} ${c.isActive ? styles.statusActive : styles.statusCancelled}`}>
                    {c.isActive ? "Ativo" : "Inativo"}
                  </span>
                </td>
              </tr>
            ))}
            {!loading && coupons.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 36, color: "var(--text-secondary)" }}>
                  Nenhum cupom cadastrado.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 36, color: "var(--text-secondary)" }}>
                  Carregando cupons...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Novo Cupom */}
      {createModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h2>Novo Cupom de Influenciador</h2>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setCreateModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateCoupon}>
              <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Código do Cupom *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: MOA10"
                      className={styles.input}
                      value={newCouponForm.code}
                      onChange={(e) => setNewCouponForm({ ...newCouponForm, code: e.target.value.toUpperCase() })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nome Identificador *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Parceria Moa Barbearia"
                      className={styles.input}
                      value={newCouponForm.name}
                      onChange={(e) => setNewCouponForm({ ...newCouponForm, name: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nome do Influenciador</label>
                    <input
                      type="text"
                      placeholder="Ex: Moa Ferreira"
                      className={styles.input}
                      value={newCouponForm.influencerName}
                      onChange={(e) => setNewCouponForm({ ...newCouponForm, influencerName: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Contato / Instagram do Influenciador</label>
                    <input
                      type="text"
                      placeholder="@moa.barber ou (11) 99999-9999"
                      className={styles.input}
                      value={newCouponForm.influencerContact}
                      onChange={(e) => setNewCouponForm({ ...newCouponForm, influencerContact: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Tipo de Desconto</label>
                    <select
                      className={styles.select}
                      value={newCouponForm.discountType}
                      onChange={(e) => setNewCouponForm({ ...newCouponForm, discountType: e.target.value })}
                    >
                      <option value="PERCENTAGE">Porcentagem (%)</option>
                      <option value="FIXED_AMOUNT">Valor Fixo (R$)</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Valor do Desconto *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      step={0.5}
                      className={styles.input}
                      value={newCouponForm.discountValue}
                      onChange={(e) => setNewCouponForm({ ...newCouponForm, discountValue: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Tipo de Comissão do Influenciador</label>
                    <select
                      className={styles.select}
                      value={newCouponForm.commissionType}
                      onChange={(e) => setNewCouponForm({ ...newCouponForm, commissionType: e.target.value })}
                    >
                      <option value="NONE">Sem comissão (Apenas rastreio)</option>
                      <option value="PERCENTAGE">Porcentagem sobre a assinatura (%)</option>
                      <option value="FIXED">Valor fixo por conversão (R$)</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Valor da Comissão</label>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      className={styles.input}
                      value={newCouponForm.commissionValue}
                      onChange={(e) => setNewCouponForm({ ...newCouponForm, commissionValue: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Duração do Desconto</label>
                    <select
                      className={styles.select}
                      value={newCouponForm.durationType}
                      onChange={(e) => setNewCouponForm({ ...newCouponForm, durationType: e.target.value })}
                    >
                      <option value="ONCE">Apenas no 1º mês (Primeira cobrança)</option>
                      <option value="LIMITED_CYCLES">Número limitado de ciclos</option>
                      <option value="FOREVER">Vitalício (Para sempre)</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Limite Máximo de Usos</label>
                    <input
                      type="number"
                      min={1}
                      placeholder="Ilimitado se vazio"
                      className={styles.input}
                      value={newCouponForm.maxRedemptions ?? ""}
                      onChange={(e) => setNewCouponForm({ ...newCouponForm, maxRedemptions: e.target.value ? parseInt(e.target.value, 10) : null })}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setCreateModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  Salvar Cupom
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Exportar CSV */}
      {exportModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h2>Exportar Resgates em CSV</h2>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setExportModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Filtrar por Cupom</label>
                <select
                  className={styles.select}
                  value={exportForm.couponId}
                  onChange={(e) => setExportForm({ ...exportForm, couponId: e.target.value })}
                >
                  <option value="">Todos os Cupons</option>
                  {coupons.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.influencerName || c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Data Inicial</label>
                  <input
                    type="date"
                    className={styles.input}
                    value={exportForm.startDate}
                    onChange={(e) => setExportForm({ ...exportForm, startDate: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Data Final</label>
                  <input
                    type="date"
                    className={styles.input}
                    value={exportForm.endDate}
                    onChange={(e) => setExportForm({ ...exportForm, endDate: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setExportModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleTriggerExport}
              >
                <Download size={14} />
                Baixar Planilha CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
