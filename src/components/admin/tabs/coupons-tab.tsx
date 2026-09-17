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
  Ban,
  RotateCcw,
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
      console.error("Erro ao carregar cupons:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      if (mounted) void loadCoupons();
    }, 0);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
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

  const handleToggleActive = async (coupon: any) => {
    try {
      const res = await fetch(`/api/superadmin/saas-coupons/${coupon.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !coupon.isActive }),
      });
      if (!res.ok) {
        alert("Erro ao alterar status do cupom.");
        return;
      }
      void loadCoupons();
    } catch (err: any) {
      alert("Erro: " + err.message);
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
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8, color: "#ffffff" }}>
            <Ticket size={18} color="#dcff4c" />
            Cupons SaaS & Afiliados / Influenciadores
          </h2>
        </div>

        <div className={styles.toolbarRight}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setExportModalOpen(true)}
          >
            <Download size={15} />
            Exportar CSV
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus size={15} />
            + Novo Cupom
          </button>
        </div>
      </div>

      {/* Table Desktop */}
      <div className={styles.tableWrapper}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Código / Nome</th>
              <th>Influenciador & Contato</th>
              <th>Desconto</th>
              <th>Comissão</th>
              <th>Resgates</th>
              <th>Conversão</th>
              <th>Receita Gerada</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id}>
                <td>
                  <div style={{ fontWeight: 700, color: "#dcff4c", fontSize: 14 }}>{c.code}</div>
                  <div style={{ fontSize: 12, color: "#a3a3a3" }}>{c.name}</div>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{c.influencerName || "—"}</div>
                  <div style={{ fontSize: 12, color: "#a3a3a3" }}>
                    {c.influencerContact || "Sem contato informado"}
                  </div>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>
                    {c.discountType === "PERCENTAGE" ? `${c.discountValue}% OFF` : `R$ ${c.discountValue} OFF`}
                  </div>
                  <div style={{ fontSize: 11, color: "#a3a3a3" }}>
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
                    <span style={{ color: "#a3a3a3" }}>Sem comissão</span>
                  )}
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{c.totalUses} resgates</div>
                  <div style={{ fontSize: 11, color: "#a3a3a3" }}>
                    {c.maxRedemptions ? `Limite: ${c.maxRedemptions}` : "Sem limite"}
                  </div>
                </td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className={`${styles.statusPill} ${styles.statusActive}`}>
                      {c.conversionRate}% taxa
                    </span>
                    <span style={{ fontSize: 12, color: "#a3a3a3" }}>
                      ({c.convertedUses} assinantes)
                    </span>
                  </div>
                </td>
                <td>
                  <div style={{ fontWeight: 600, color: "#10b981" }}>
                    {formatCurrency(c.totalRevenueGenerated)}
                  </div>
                  <div style={{ fontSize: 11, color: "#a3a3a3" }}>
                    Desconto: {formatCurrency(c.totalDiscountGiven)}
                  </div>
                </td>
                <td>
                  <span className={`${styles.statusPill} ${c.isActive ? styles.statusActive : styles.statusCancelled}`}>
                    {c.isActive ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    title={c.isActive ? "Desativar cupom" : "Ativar cupom"}
                    style={{ color: c.isActive ? "#f87171" : "#10b981" }}
                    onClick={() => void handleToggleActive(c)}
                  >
                    {c.isActive ? <Ban size={15} /> : <RotateCcw size={15} />}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && coupons.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: 36, color: "#a3a3a3" }}>
                  Nenhum cupom SaaS cadastrado.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: 36, color: "#a3a3a3" }}>
                  Carregando cupons do MySQL...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards List */}
      <div className={styles.mobileCardsList}>
        {coupons.map((c) => (
          <div key={c.id} className={styles.mobileCard}>
            <div className={styles.mobileCardHeader}>
              <div>
                <div style={{ fontWeight: 700, color: "#dcff4c", fontSize: 14 }}>{c.code}</div>
                <div style={{ fontSize: 12, color: "#a3a3a3" }}>{c.name}</div>
              </div>
              <span className={`${styles.statusPill} ${c.isActive ? styles.statusActive : styles.statusCancelled}`}>
                {c.isActive ? "Ativo" : "Inativo"}
              </span>
            </div>

            <div className={styles.mobileCardBody}>
              <div>
                <span style={{ color: "#737373" }}>Influenciador:</span> {c.influencerName || "—"}
              </div>
              <div>
                <span style={{ color: "#737373" }}>Desconto:</span>{" "}
                {c.discountType === "PERCENTAGE" ? `${c.discountValue}%` : `R$ ${c.discountValue}`}
              </div>
              <div>
                <span style={{ color: "#737373" }}>Resgates:</span> {c.totalUses} ({c.convertedUses} pagos)
              </div>
              <div>
                <span style={{ color: "#737373" }}>Receita:</span>{" "}
                <strong style={{ color: "#10b981" }}>{formatCurrency(c.totalRevenueGenerated)}</strong>
              </div>
            </div>

            <div className={styles.mobileCardActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => void handleToggleActive(c)}
              >
                {c.isActive ? "Desativar Cupom" : "Ativar Cupom"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Novo Cupom */}
      {createModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h2>Novo Cupom de Assinatura SaaS</h2>
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
                      className={styles.input}
                      placeholder="Ex: VIP50, YOUTUBE30"
                      value={newCouponForm.code}
                      onChange={(e) =>
                        setNewCouponForm({
                          ...newCouponForm,
                          code: e.target.value.toUpperCase().replace(/\s+/g, ""),
                        })
                      }
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nome Interno / Campanha *</label>
                    <input
                      type="text"
                      required
                      className={styles.input}
                      placeholder="Ex: Parceria Podcast Barbearia"
                      value={newCouponForm.name}
                      onChange={(e) =>
                        setNewCouponForm({ ...newCouponForm, name: e.target.value })
                      }
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nome do Influenciador / Parceiro</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="Ex: Lucas Ferreira"
                      value={newCouponForm.influencerName}
                      onChange={(e) =>
                        setNewCouponForm({ ...newCouponForm, influencerName: e.target.value })
                      }
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Contato do Influenciador</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="WhatsApp ou e-mail"
                      value={newCouponForm.influencerContact}
                      onChange={(e) =>
                        setNewCouponForm({ ...newCouponForm, influencerContact: e.target.value })
                      }
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Tipo de Desconto</label>
                    <select
                      className={styles.select}
                      value={newCouponForm.discountType}
                      onChange={(e) =>
                        setNewCouponForm({ ...newCouponForm, discountType: e.target.value })
                      }
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
                      min={1}
                      className={styles.input}
                      value={newCouponForm.discountValue}
                      onChange={(e) =>
                        setNewCouponForm({
                          ...newCouponForm,
                          discountValue: Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Duração do Desconto</label>
                    <select
                      className={styles.select}
                      value={newCouponForm.durationType}
                      onChange={(e) =>
                        setNewCouponForm({ ...newCouponForm, durationType: e.target.value })
                      }
                    >
                      <option value="ONCE">Apenas na primeira mensalidade</option>
                      <option value="LIMITED_CYCLES">Por quantidade de meses/ciclos</option>
                      <option value="FOREVER">Vitalício (enquanto durar a assinatura)</option>
                    </select>
                  </div>

                  {newCouponForm.durationType === "LIMITED_CYCLES" && (
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Quantidade de Ciclos</label>
                      <input
                        type="number"
                        min={1}
                        max={36}
                        className={styles.input}
                        value={newCouponForm.durationCycles}
                        onChange={(e) =>
                          setNewCouponForm({
                            ...newCouponForm,
                            durationCycles: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  )}

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Limite Máximo de Resgates</label>
                    <input
                      type="number"
                      min={1}
                      placeholder="Deixe em branco para ilimitado"
                      className={styles.input}
                      value={newCouponForm.maxRedemptions ?? ""}
                      onChange={(e) =>
                        setNewCouponForm({
                          ...newCouponForm,
                          maxRedemptions: e.target.value ? Number(e.target.value) : null,
                        })
                      }
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
                  Salvar Cupom no MySQL
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
              <h2>Exportar Relatório de Resgates</h2>
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
                      {c.code} — {c.name}
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
                    onChange={(e) =>
                      setExportForm({ ...exportForm, startDate: e.target.value })
                    }
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
                Baixar CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
