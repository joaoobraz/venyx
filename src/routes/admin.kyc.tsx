import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Check, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { requireAdminServer } from "@/server/admin.functions";

export const Route = createFileRoute("/admin/kyc")({
  beforeLoad: async () => {
    try {
      await requireAdminServer();
    } catch {
      throw redirect({ to: "/feed" });
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
  created_at: string;
}

function AdminKycPage() {
  const { user, isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
    else if (!isAdmin) nav({ to: "/feed" });
  }, [user, isAdmin, loading, nav]);

  const load = async () => {
    const { data } = await supabase
      .from("kyc_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    setRows((data as Row[]) ?? []);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const approve = async (r: Row) => {
    const { error: e1 } = await supabase
      .from("kyc_requests")
      .update({ status: "approved", reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
      .eq("id", r.id);
    if (e1) return toast.error(e1.message);
    const { error: e2 } = await supabase
      .from("user_roles")
      .insert({ user_id: r.user_id, role: "creator" });
    if (e2 && !e2.message.includes("duplicate")) return toast.error(e2.message);
    await supabase.from("profiles").update({ is_verified: true }).eq("user_id", r.user_id);
    toast.success("KYC aprovado");
    load();
  };

  const reject = async (r: Row) => {
    const reason = window.prompt("Motivo da rejeição?");
    if (!reason) return;
    const { error } = await supabase
      .from("kyc_requests")
      .update({ status: "rejected", rejection_reason: reason, reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success("Rejeitado"); load(); }
  };

  if (!isAdmin) return null;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground">
          <ShieldCheck className="h-5 w-5 text-primary" /> Pedidos de KYC pendentes
        </h1>
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Nada pendente.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="rounded-2xl bg-card p-4">
                <div className="text-xs text-muted-foreground">User: {r.user_id}</div>
                <div className="mt-1 text-sm text-foreground">Documento: {r.document_type}</div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
                  <div>Front: <code>{r.document_front_url}</code></div>
                  {r.document_back_url && <div>Back: <code>{r.document_back_url}</code></div>}
                  <div>Selfie: <code>{r.selfie_url}</code></div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => approve(r)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Check className="mr-1 h-4 w-4" /> Aprovar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => reject(r)}>
                    <X className="mr-1 h-4 w-4" /> Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
