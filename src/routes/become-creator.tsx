import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Check, ShieldCheck, DollarSign, MessageCircle, Crown, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/become-creator")({
  component: BecomeCreatorPage,
});

function BecomeCreatorPage() {
  const { t } = useI18n();
  const { user, isCreator, kyc, loading, refresh } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState<"intro" | "form">("intro");

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  if (!user) return null;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        {isCreator ? (
          <div className="rounded-2xl bg-gradient-card p-8 text-center shadow-card">
            <Check className="mx-auto h-10 w-10 text-primary" />
            <h2 className="mt-3 text-xl font-bold text-foreground">Você já é criadora!</h2>
          </div>
        ) : kyc?.status === "pending" ? (
          <div className="rounded-2xl border border-primary/30 bg-card p-8 text-center">
            <Clock className="mx-auto h-10 w-10 text-primary" />
            <h2 className="mt-3 text-xl font-bold text-foreground">{t("becomeCreator.banner.pending")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">Avisaremos por e-mail assim que aprovado.</p>
          </div>
        ) : kyc?.status === "rejected" ? (
          <div className="rounded-2xl border border-destructive/30 bg-card p-8">
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
            <h2 className="mt-3 text-center text-xl font-bold text-foreground">Verificação rejeitada</h2>
            {kyc.rejection_reason && (
              <p className="mt-2 text-center text-sm text-muted-foreground">Motivo: {kyc.rejection_reason}</p>
            )}
            <div className="mt-6 text-center">
              <Button onClick={() => setStep("form")} className="bg-primary text-primary-foreground">
                Reenviar verificação
              </Button>
            </div>
          </div>
        ) : step === "intro" ? (
          <Intro onStart={() => setStep("form")} />
        ) : (
          <KycForm onDone={async () => { await refresh(); }} />
        )}
      </div>
    </AppShell>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  const { t } = useI18n();
  const benefits = [
    { icon: DollarSign, label: t("becomeCreator.benefit1") },
    { icon: Sparkles, label: t("becomeCreator.benefit2") },
    { icon: MessageCircle, label: t("becomeCreator.benefit3") },
    { icon: ShieldCheck, label: t("becomeCreator.benefit4") },
  ];
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-primary p-8 text-primary-foreground shadow-glow">
        <h1 className="text-3xl font-bold">{t("becomeCreator.title")}</h1>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {benefits.map((b, i) => {
          const Icon = b.icon;
          return (
            <div key={i} className="flex items-start gap-3 rounded-xl bg-card p-4">
              <Icon className="h-5 w-5 shrink-0 text-primary" />
              <span className="text-sm text-foreground">{b.label}</span>
            </div>
          );
        })}
      </div>
      <Button onClick={onStart} size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {t("becomeCreator.start")}
      </Button>
    </div>
  );
}

function KycForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [docType, setDocType] = useState("RG");
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const MAX_SIZE = 8 * 1024 * 1024; // 8MB
  const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic"];

  const upload = async (file: File, name: string) => {
    if (!user) throw new Error("no user");
    if (file.size > MAX_SIZE) throw new Error(`${name}: arquivo maior que 8MB`);
    if (!ALLOWED.includes(file.type)) throw new Error(`${name}: formato não aceito (use JPG/PNG/WEBP)`);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${user.id}/${Date.now()}-${name}.${ext}`;
    const { error } = await supabase.storage.from("kyc").upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    return path;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!front || !selfie || !accepted) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    setLoading(true);
    try {
      const frontPath = await upload(front, "front");
      const backPath = back ? await upload(back, "back") : null;
      const selfiePath = await upload(selfie, "selfie");
      const { error } = await supabase.from("kyc_requests").insert({
        user_id: user!.id,
        document_type: docType,
        document_front_url: frontPath,
        document_back_url: backPath,
        selfie_url: selfiePath,
      });
      if (error) throw error;
      toast.success(t("becomeCreator.kyc.success"));
      onDone();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5 rounded-2xl bg-card p-6">
      <h2 className="text-xl font-bold text-foreground">{t("becomeCreator.kyc.title")}</h2>
      <div>
        <Label>{t("becomeCreator.kyc.docType")}</Label>
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="RG">RG</option>
          <option value="CNH">CNH</option>
          <option value="Passport">Passaporte</option>
        </select>
      </div>
      <FileField label={t("becomeCreator.kyc.front")} onChange={setFront} />
      <FileField label={t("becomeCreator.kyc.back")} onChange={setBack} optional />
      <FileField label={t("becomeCreator.kyc.selfie")} onChange={setSelfie} />
      <label className="flex items-start gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[oklch(0.72_0.19_47)]"
        />
        {t("becomeCreator.kyc.terms")}
      </label>
      <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {loading ? t("common.loading") : t("becomeCreator.kyc.submit")}
      </Button>
    </form>
  );
}

function FileField({ label, onChange, optional }: { label: string; onChange: (f: File | null) => void; optional?: boolean }) {
  return (
    <div>
      <Label>
        {label} {optional && <span className="text-xs text-muted-foreground">(opcional)</span>}
      </Label>
      <Input
        type="file"
        accept="image/*"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="mt-1.5"
      />
    </div>
  );
}
