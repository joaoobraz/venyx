import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Check, X, Clock, FileText, Download, Eye } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { requireAdminServer, getKycSignedUrlServer } from "@/server/admin.functions";

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
  document_type: string;
  document_front_url: string;
  document_back_url: string | null;
  selfie_url: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  profile?: { username: string; display_name: string | null } | null;
}

type Tab = "pending" | "approved" | "rejected";

function AdminKycPage() {
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
    const { data } = await supabase
      .from("kyc_requests")
      .select("*")
      .eq("status", tab)
      .order("created_at", { ascending: tab === "pending" });
    const list = (data ?? []) as Row[];
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
    const { error: e1 } = await supabase
      .from("kyc_requests")
      .update({ status: "approved", reviewed_by: user!.id, reviewed_at: new Date().toISOString(), rejection_reason: null })
      .eq("id", r.id);
    if (e1) return toast.error(e1.message);
    const { error: e2 } = await supabase
      .from("user_roles")
      .insert({ user_id: r.user_id, role: "creator" });
    if (e2 && !e2.message.includes("duplicate")) return toast.error(e2.message);
    await supabase.from("profiles").update({ is_verified: true }).eq("user_id", r.user_id);
    toast.success("KYC aprovado — usuária promovida a criadora");
    load();
  };

  const reject = async (r: Row) => {
    const reason = window.prompt("Motivo da rejeição (será mostrado para a criadora)?");
    if (!reason) return;
    const { error } = await supabase
      .from("kyc_requests")
      .update({ status: "rejected", rejection_reason: reason, reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success("Rejeitado"); load(); }
  };

  if (!isAdmin) return null;

  const tabs: { id: Tab; label: string; icon: typeof Clock }[] = [
    { id: "pending", label: "Em análise", icon: Clock },
    { id: "approved", label: "Aprovados", icon: Check },
    { id: "rejected", label: "Rejeitados", icon: X },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground">
          <ShieldCheck className="h-5 w-5 text-primary" /> Painel KYC
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
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>

        {loadingRows ? (
          <div className="rounded-2xl border border-border p-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Nada por aqui.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <KycCard key={r.id} row={r} tab={tab} onApprove={() => approve(r)} onReject={() => reject(r)} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function KycCard({ row, tab, onApprove, onReject }: { row: Row; tab: Tab; onApprove: () => void; onReject: () => void }) {
  return (
    <div className="rounded-2xl bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">
            @{row.profile?.username ?? "—"}{" "}
            {row.profile?.display_name && (
              <span className="font-normal text-muted-foreground">· {row.profile.display_name}</span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            <FileText className="mr-1 inline h-3 w-3" />
            {row.document_type} · enviado em {new Date(row.created_at).toLocaleString("pt-BR")}
          </div>
          {row.reviewed_at && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              Revisado em {new Date(row.reviewed_at).toLocaleString("pt-BR")}
            </div>
          )}
          {row.rejection_reason && (
            <div className="mt-1 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
              Motivo: {row.rejection_reason}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <DocPreview path={row.document_front_url} label="Frente" />
        {row.document_back_url ? (
          <DocPreview path={row.document_back_url} label="Verso" />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-muted text-[10px] text-muted-foreground">
            sem verso
          </div>
        )}
        <DocPreview path={row.selfie_url} label="Selfie" />
      </div>

      {tab === "pending" && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={onApprove} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Check className="mr-1 h-4 w-4" /> Aprovar
          </Button>
          <Button size="sm" variant="outline" onClick={onReject}>
            <X className="mr-1 h-4 w-4" /> Rejeitar
          </Button>
        </div>
      )}
    </div>
  );
}

function DocPreview({ path, label }: { path: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sign = async () => {
    if (url) return url;
    setLoading(true);
    const { data, error } = await supabase.storage.from("kyc").createSignedUrl(path, 300);
    setLoading(false);
    if (error || !data) {
      toast.error("Não foi possível abrir o documento");
      return null;
    }
    setUrl(data.signedUrl);
    return data.signedUrl;
  };

  const view = async () => {
    const u = await sign();
    if (u) window.open(u, "_blank", "noopener,noreferrer");
  };

  const download = async () => {
    const { data, error } = await supabase.storage.from("kyc").download(path);
    if (error || !data) return toast.error("Falha no download");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(data);
    a.download = path.split("/").pop() ?? "kyc";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="group relative overflow-hidden rounded-lg bg-muted">
      <div className="flex aspect-[4/3] items-center justify-center">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <button
            onClick={sign}
            disabled={loading}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            {loading ? "…" : `Carregar ${label.toLowerCase()}`}
          </button>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-2 py-1 text-[10px] text-white">
        <span>{label}</span>
        <div className="flex gap-1">
          <button onClick={view} title="Abrir" className="hover:text-primary"><Eye className="h-3 w-3" /></button>
          <button onClick={download} title="Baixar" className="hover:text-primary"><Download className="h-3 w-3" /></button>
        </div>
      </div>
    </div>
  );
}
