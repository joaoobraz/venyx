import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { requireAdminServer } from "@/server/admin.functions";

export const Route = createFileRoute("/admin/dmca")({
  beforeLoad: async () => {
    try {
      await requireAdminServer({ data: { path: "/admin/dmca" } });
    } catch {
      throw redirect({ to: "/403" });
    }
  },
  component: AdminDmcaPage,
});

interface Report {
  id: string;
  creator_id: string;
  leaked_url: string;
  description: string | null;
  evidence_path: string | null;
  status: "pending" | "notified" | "resolved" | "rejected";
  admin_notes: string | null;
  created_at: string;
}

function AdminDmcaPage() {
  const { user, isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [profiles, setProfiles] = useState<Map<string, { username: string; display_name: string | null }>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
    else if (!isAdmin) nav({ to: "/feed" });
  }, [user, isAdmin, loading, nav]);

  const load = async () => {
    const { data } = await supabase
      .from("dmca_reports")
      .select("*")
      .order("created_at", { ascending: false });
    const list = (data as Report[]) ?? [];
    setReports(list);
    const ids = Array.from(new Set(list.map((r) => r.creator_id)));
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, username, display_name")
        .in("user_id", ids);
      const m = new Map<string, { username: string; display_name: string | null }>();
      ((profs ?? []) as { user_id: string; username: string; display_name: string | null }[]).forEach((p) =>
        m.set(p.user_id, { username: p.username, display_name: p.display_name }),
      );
      setProfiles(m);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (!user || !isAdmin) return null;

  const updateStatus = async (id: string, status: "notified" | "resolved" | "rejected") => {
    setBusy(id);
    try {
      const { error } = await supabase
        .from("dmca_reports")
        .update({ status, admin_notes: notes[id] || null })
        .eq("id", id);
      if (error) throw error;
      toast.success("Atualizado");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  };

  const downloadPdf = (r: Report) => {
    const prof = profiles.get(r.creator_id);
    const name = prof?.display_name || prof?.username || "Criadora";
    const text = `NOTIFICAÇÃO DMCA — VENYX
=========================
Data: ${new Date().toLocaleString("pt-BR")}

Para o responsável pelo site/serviço hospedando conteúdo infrator,

Em conformidade com o Digital Millennium Copyright Act (DMCA) — 17 U.S.C. § 512(c)(3) — e legislação equivalente brasileira (Lei 9.610/98 c/c Marco Civil da Internet), notificamos que o seguinte conteúdo está sendo distribuído sem autorização da titular dos direitos autorais:

URL infratora: ${r.leaked_url}
Titular dos direitos: ${name} (@${prof?.username ?? ""})
Plataforma original: Venyx (venyx.app)
Descrição: ${r.description ?? "—"}

A titular declara, sob pena de perjúrio:
1. Que é a legítima titular dos direitos autorais sobre o conteúdo identificado.
2. Que não autorizou o uso do material na URL acima.
3. Que as informações nesta notificação são verdadeiras.

Solicitamos a remoção imediata (takedown) do conteúdo infrator.

Contato Venyx: legal@venyx.app
Notas administrativas: ${r.admin_notes ?? "—"}

Assinatura digital: VENYX-DMCA-${r.id.slice(0, 8).toUpperCase()}`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dmca-${r.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-accent" />
          <h1 className="text-xl font-bold text-foreground">DMCA — Painel Admin</h1>
        </div>

        {reports.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum report.
          </p>
        ) : (
          reports.map((r) => {
            const prof = profiles.get(r.creator_id);
            return (
              <div key={r.id} className="space-y-2 rounded-2xl bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">
                      @{prof?.username ?? "?"} • {new Date(r.created_at).toLocaleString("pt-BR")}
                    </div>
                    <div className="mt-1 break-all text-sm text-foreground">🔗 {r.leaked_url}</div>
                    {r.description && <div className="mt-1 text-xs text-muted-foreground">{r.description}</div>}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      r.status === "resolved"
                        ? "bg-green-500/20 text-green-400"
                        : r.status === "notified"
                          ? "bg-accent/20 text-accent"
                          : r.status === "rejected"
                            ? "bg-destructive/20 text-destructive"
                            : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                <Textarea
                  placeholder="Notas administrativas..."
                  value={notes[r.id] ?? r.admin_notes ?? ""}
                  onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                  className="min-h-16 resize-none text-xs"
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => downloadPdf(r)} variant="outline">
                    <FileText className="mr-1 h-3.5 w-3.5" /> Gerar notificação
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy === r.id}
                    onClick={() => updateStatus(r.id, "notified")}
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Marcar notificado"}
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy === r.id}
                    onClick={() => updateStatus(r.id, "resolved")}
                    variant="outline"
                  >
                    Resolvido
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy === r.id}
                    onClick={() => updateStatus(r.id, "rejected")}
                    variant="outline"
                  >
                    Rejeitar
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
