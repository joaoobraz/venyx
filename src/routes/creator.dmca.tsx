import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent } from "react";
import { Loader2, Shield, Upload, FileWarning } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/creator/dmca")({
  component: DmcaPage,
});

interface Report {
  id: string;
  leaked_url: string;
  status: "pending" | "notified" | "resolved" | "rejected";
  created_at: string;
  admin_notes: string | null;
}

function DmcaPage() {
  const { user, isCreator, loading } = useAuth();
  const nav = useNavigate();
  const [url, setUrl] = useState("");
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
    else if (!isCreator) nav({ to: "/become-creator" });
  }, [user, isCreator, loading, nav]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("dmca_reports")
      .select("id, leaked_url, status, created_at, admin_notes")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false });
    setReports((data as Report[]) ?? []);
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user || !isCreator) return null;

  const submit = async () => {
    if (!url.trim()) {
      toast.error("Informe a URL do vazamento");
      return;
    }
    setBusy(true);
    try {
      let evidence_path: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: ue } = await supabase.storage.from("dmca-evidence").upload(path, file, { contentType: file.type });
        if (ue) throw ue;
        evidence_path = path;
      }
      const { error } = await supabase.from("dmca_reports").insert({
        creator_id: user.id,
        leaked_url: url.trim(),
        description: desc.trim() || null,
        evidence_path,
      });
      if (error) throw error;
      toast.success("Denúncia registrada. Nossa equipe vai analisar.");
      setUrl("");
      setDesc("");
      setFile(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="rounded-2xl bg-gradient-card p-5 shadow-card">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-accent" />
            <h1 className="text-xl font-bold text-foreground">Denúncia DMCA</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Encontrou seu conteúdo vazado em outro site? Envie a URL e nosso time gera a notificação formal de takedown.
          </p>
        </div>

        <div className="space-y-3 rounded-2xl bg-card p-5">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">URL onde o conteúdo está vazado</label>
            <Input placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Descrição (opcional)</label>
            <Textarea
              placeholder="Qual conteúdo foi vazado, contexto..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={1000}
              className="resize-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Prova (screenshot, opcional)</label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-background p-3 text-sm text-muted-foreground hover:border-primary">
              <Upload className="h-4 w-4 text-primary" />
              {file ? file.name : "Anexar arquivo"}
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} />
            </label>
          </div>
          <Button onClick={submit} disabled={busy} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar denúncia"}
          </Button>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Suas denúncias</h2>
          {reports.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhuma denúncia ainda.
            </p>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="rounded-2xl bg-card p-4">
                <div className="flex items-start gap-2">
                  <FileWarning className="mt-0.5 h-4 w-4 text-accent" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-foreground">{r.leaked_url}</div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </div>
                    {r.admin_notes && <div className="mt-1 text-xs text-foreground">📝 {r.admin_notes}</div>}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
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
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
