import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Check, X, Clock, FileText, Download, Eye } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  requireAdminServer,
  getKycSignedUrlServer,
  reviewKycServer,
  reviewIdentityVerificationServer,
} from "@/_server/admin.functions";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/admin/kyc")({
  beforeLoad: async () => {
    try {
      await requireAdminServer({ data: { path: "/admin/kyc" } });
    } catch {
      throw redirect({ to: "/403" });
    }
  },
  component: AdminKycPage,
});

interface Row {
  id: string;
  user_id: string;
  source: "creator" | "customer";
  document_type: string;
  document_front_url: string;
  document_back_url: string | null;
  selfie_url: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  full_name?: string | null;
  cpf?: string | null;
  birth_date?: string | null;
  profile?: { username: string; display_name: string | null } | null;
}

type Tab = "pending" | "approved" | "rejected";

export function AdminKycPage() {
  const { tr } = useI18n();
  const { user, isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<Tab>("pending");
  const [loadingRows, setLoadingRows] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
    else if (!isAdmin) nav({ to: "/feed" });
  }, [user, isAdmin, loading, nav]);

  const load = async () => {
    setLoadingRows(true);
    const [{ data: creatorData }, { data: customerData }] = await Promise.all([
      supabase
        .from("kyc_requests")
        .select("*")
        .eq("status", tab)
        .order("created_at", { ascending: tab === "pending" }),
      supabase
        .from("identity_verifications")
        .select("*")
        .eq("method", "manual_document_review")
        .eq("status", tab === "approved" ? "verified" : tab)
        .order("created_at", { ascending: tab === "pending" }),
    ]);
    const creatorRows = ((creatorData ?? []) as Omit<Row, "source">[]).map((row) => ({
      ...row,
      source: "creator" as const,
    }));
    const customerRows = (
      (customerData ?? []) as Array<{
        id: string;
        user_id: string;
        document_type: string | null;
        document_front_url: string | null;
        document_back_url: string | null;
        selfie_url: string | null;
        status: "pending" | "verified" | "rejected";
        rejection_reason: string | null;
        reviewed_at: string | null;
        created_at: string;
        full_name: string;
        cpf: string;
        birth_date: string;
      }>
    )
      .filter((row) => row.document_front_url && row.selfie_url)
      .map((row) => ({
        ...row,
        source: "customer" as const,
        status: (row.status === "verified" ? "approved" : row.status) as Row["status"],
        document_type: row.document_type ?? "Documento",
        document_front_url: row.document_front_url as string,
        selfie_url: row.selfie_url as string,
      }));
    const list: Row[] = [...creatorRows, ...customerRows].sort((a, b) =>
      tab === "pending"
        ? a.created_at.localeCompare(b.created_at)
        : b.created_at.localeCompare(a.created_at),
    );
    // Buscar profiles em batch
    const ids = [...new Set(list.map((r) => r.user_id))];
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, username, display_name")
        .in("user_id", ids);
      const map = new Map((profs ?? []).map((p) => [p.user_id, p]));
      list.forEach((r) => {
        const p = map.get(r.user_id);
        r.profile = p ? { username: p.username, display_name: p.display_name } : null;
      });
    }
    setRows(list);
    setLoadingRows(false);
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, tab]);

  const approve = async (r: Row) => {
    try {
      if (r.source === "creator") {
        await reviewKycServer({ data: { kycId: r.id, decision: "approved" } });
      } else {
        await reviewIdentityVerificationServer({
          data: { verificationId: r.id, decision: "approved" },
        });
      }
      toast.success(
        r.source === "creator"
          ? tr(
              "KYC aprovado — usuária promovida a criadora",
              "KYC approved—user promoted to creator",
            )
          : tr("Maioridade aprovada — acesso liberado", "Age check approved—access granted"),
      );
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("Erro ao aprovar", "Could not approve"));
    }
  };

  const reject = async (r: Row) => {
    const reason = window.prompt(
      tr(
        "Motivo da rejeição (será mostrado para a criadora)?",
        "Reason for rejection (shown to the creator)?",
      ),
    );
    if (!reason) return;
    try {
      if (r.source === "creator") {
        await reviewKycServer({
          data: { kycId: r.id, decision: "rejected", rejectionReason: reason },
        });
      } else {
        await reviewIdentityVerificationServer({
          data: {
            verificationId: r.id,
            decision: "rejected",
            rejectionReason: reason,
          },
        });
      }
      toast.success(tr("Rejeitado", "Rejected"));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("Erro ao rejeitar", "Could not reject"));
    }
  };

  if (!isAdmin) return null;

  const tabs: { id: Tab; label: string; icon: typeof Clock }[] = [
    { id: "pending", label: tr("Em análise", "Under review"), icon: Clock },
    { id: "approved", label: tr("Aprovados", "Approved"), icon: Check },
    { id: "rejected", label: tr("Rejeitados", "Rejected"), icon: X },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground">
          <ShieldCheck className="h-5 w-5 text-primary" /> {tr("Painel KYC", "KYC dashboard")}
        </h1>

        <div className="mb-4 flex gap-1 rounded-xl bg-card p-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>

        {loadingRows ? (
          <div className="rounded-2xl border border-border p-10 text-center text-sm text-muted-foreground">
            {tr("Carregando…", "Loading…")}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            {tr("Nada por aqui.", "Nothing here.")}
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <KycCard
                key={r.id}
                row={r}
                tab={tab}
                onApprove={() => approve(r)}
                onReject={() => reject(r)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function KycCard({
  row,
  tab,
  onApprove,
  onReject,
}: {
  row: Row;
  tab: Tab;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { locale, tr } = useI18n();
  return (
    <div className="rounded-2xl bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">
            @{row.profile?.username ?? "—"}{" "}
            {row.profile?.display_name && (
              <span className="font-normal text-muted-foreground">
                · {row.profile.display_name}
              </span>
            )}
          </div>
          <div className="mt-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {row.source === "creator"
              ? tr("Entrada de criadora", "Creator onboarding")
              : tr("Cliente · verificação +18", "Customer · 18+ check")}
          </div>
          {row.source === "customer" && (
            <div className="mt-2 rounded-lg border border-border/60 bg-background/40 p-2 text-xs text-foreground">
              <div>{row.full_name}</div>
              <div className="text-muted-foreground">
                CPF {row.cpf} · {tr("nascimento", "date of birth")} {row.birth_date}
              </div>
            </div>
          )}
          <div className="mt-0.5 text-xs text-muted-foreground">
            <FileText className="mr-1 inline h-3 w-3" />
            {row.document_type} · {tr("enviado em", "submitted")}{" "}
            {new Date(row.created_at).toLocaleString(locale)}
          </div>
          {row.reviewed_at && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              {tr("Revisado em", "Reviewed")} {new Date(row.reviewed_at).toLocaleString(locale)}
            </div>
          )}
          {row.rejection_reason && (
            <div className="mt-1 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
              {tr("Motivo", "Reason")}: {row.rejection_reason}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <DocPreview path={row.document_front_url} label={tr("Frente", "Front")} />
        {row.document_back_url ? (
          <DocPreview path={row.document_back_url} label={tr("Verso", "Back")} />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-muted text-[10px] text-muted-foreground">
            {tr("sem verso", "no back")}
          </div>
        )}
        <DocPreview path={row.selfie_url} label="Selfie" />
      </div>

      {tab === "pending" && (
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            onClick={onApprove}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Check className="mr-1 h-4 w-4" /> {tr("Aprovar", "Approve")}
          </Button>
          <Button size="sm" variant="outline" onClick={onReject}>
            <X className="mr-1 h-4 w-4" /> {tr("Rejeitar", "Reject")}
          </Button>
        </div>
      )}
    </div>
  );
}

function DocPreview({ path, label }: { path: string; label: string }) {
  const { tr } = useI18n();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sign = async () => {
    if (url) return url;
    setLoading(true);
    try {
      const { url: signedUrl } = await getKycSignedUrlServer({ data: { path } });
      setLoading(false);
      setUrl(signedUrl);
      return signedUrl;
    } catch {
      setLoading(false);
      toast.error(tr("Não foi possível abrir o documento", "Could not open the document"));
      return null;
    }
  };

  const view = async () => {
    const u = await sign();
    if (u) window.open(u, "_blank", "noopener,noreferrer");
  };

  const download = async () => {
    const u = await sign();
    if (!u) return;
    try {
      const res = await fetch(u);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = path.split("/").pop() ?? "kyc";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error(tr("Falha no download", "Download failed"));
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-lg bg-muted">
      <div className="flex aspect-[4/3] items-center justify-center">
        {url ? (
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <button
            onClick={sign}
            disabled={loading}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            {loading ? "…" : tr(`Carregar ${label.toLowerCase()}`, `Load ${label.toLowerCase()}`)}
          </button>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-2 py-1 text-[10px] text-white">
        <span>{label}</span>
        <div className="flex gap-1">
          <button onClick={view} title={tr("Abrir", "Open")} className="hover:text-primary">
            <Eye className="h-3 w-3" />
          </button>
          <button
            onClick={download}
            title={tr("Baixar", "Download")}
            className="hover:text-primary"
          >
            <Download className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
