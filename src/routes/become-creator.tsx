import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Check, ShieldCheck, DollarSign, MessageCircle, Crown, Clock, XCircle, ArrowRight } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitCreatorKyc } from "@/_server/creator-onboarding.functions";
import { verifyIdentity } from "@/_server/verification.functions";
import { formatCpf, isValidCpf, isAdult, onlyDigits } from "@/lib/cpf";
import { formatPhone, isValidBrazilianPhone, onlyPhoneDigits } from "@/lib/phone";

export const Route = createFileRoute("/become-creator")({
  component: BecomeCreatorPage,
});

export function BecomeCreatorPage() {
  const { t, tr } = useI18n();
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
            <h2 className="mt-3 text-xl font-bold text-foreground">
              {tr("Você já é criadora!", "You're already a creator!")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {tr(
                "Confira as etapas necessárias antes de começar a monetizar.",
                "Review the required steps before monetization.",
              )}
            </p>
            <Button asChild className="mt-5">
              <Link to="/creator/onboarding">
                {tr("Continuar configuração", "Continue setup")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : kyc?.status === "pending" ? (
          <div className="rounded-2xl border border-primary/30 bg-card p-8 text-center">
            <Clock className="mx-auto h-10 w-10 text-primary" />
            <h2 className="mt-3 text-xl font-bold text-foreground">{t("becomeCreator.banner.pending")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {tr("Avisaremos por e-mail assim que for aprovado.", "We'll email you as soon as it is approved.")}
            </p>
          </div>
        ) : kyc?.status === "rejected" && step === "intro" ? (
          <div className="rounded-2xl border border-destructive/30 bg-card p-8">
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
            <h2 className="mt-3 text-center text-xl font-bold text-foreground">
              {tr("Verificação rejeitada", "Verification rejected")}
            </h2>
            {kyc.rejection_reason && (
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {tr("Motivo", "Reason")}: {kyc.rejection_reason}
              </p>
            )}
            <div className="mt-6 text-center">
              <Button onClick={() => setStep("form")} className="bg-primary text-primary-foreground">
                {tr("Reenviar verificação", "Resubmit verification")}
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
    { icon: Crown, label: t("becomeCreator.benefit2") },
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

const CREATOR_STEPS = ["personal", "documents", "confirm"] as const;
type CreatorStep = (typeof CREATOR_STEPS)[number];

function StepProgress({ step }: { step: CreatorStep }) {
  const { tr } = useI18n();
  const index = CREATOR_STEPS.indexOf(step);
  const labels = [
    tr("Dados pessoais", "Personal data"),
    tr("Documento", "Document"),
    tr("Confirmação", "Confirmation"),
  ];
  return (
    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
      {labels.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <span
            className={
              i <= index
                ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground"
                : "flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground"
            }
          >
            {i + 1}
          </span>
          <span className={i === index ? "font-medium text-foreground" : undefined}>{label}</span>
          {i < labels.length - 1 && <span className="text-muted-foreground/50">—</span>}
        </div>
      ))}
    </div>
  );
}

function KycForm({ onDone }: { onDone: () => void }) {
  const { t, tr } = useI18n();
  const { user } = useAuth();
  const submitKycFn = useServerFn(submitCreatorKyc);
  const verifyFn = useServerFn(verifyIdentity);
  const [step, setStep] = useState<CreatorStep>("personal");

  // Dados pessoais
  const [country, setCountry] = useState("BR");
  const [cpf, setCpf] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Documento
  const [docType, setDocType] = useState<"RG" | "CNH" | "Passport">("RG");
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);

  // Confirmação
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [confirmedAdult, setConfirmedAdult] = useState(false);
  const [confirmedContentRights, setConfirmedContentRights] = useState(false);
  const [loading, setLoading] = useState(false);

  const MAX_SIZE = 8 * 1024 * 1024; // 8MB
  const DOCUMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
  const SELFIE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  const setFieldError = (field: string, message: string | null) => {
    setFieldErrors((prev) => {
      if (!message) {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return { ...prev, [field]: message };
    });
  };

  const goToDocuments = () => {
    const errors: Record<string, string> = {};
    if (!isValidCpf(cpf)) errors.cpf = tr("CPF inválido. Confira os números.", "Invalid CPF. Check the numbers.");
    if (fullName.trim().split(/\s+/).length < 2) {
      errors.fullName = tr("Digite seu nome completo, como no documento.", "Enter your full name, as on your document.");
    }
    if (!isValidBrazilianPhone(phone)) {
      errors.phone = tr("Telefone inválido. Confira o DDD e o número.", "Invalid phone. Check the area code and number.");
    }
    if (!birthDate) errors.birthDate = tr("Informe sua data de nascimento.", "Enter your date of birth.");
    else if (!isAdult(birthDate)) {
      errors.birthDate = tr("Você precisa ter 18 anos ou mais.", "You must be 18 or older.");
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length === 0) setStep("documents");
  };

  const upload = async (file: File, name: string, document = false) => {
    if (!user) throw new Error("no user");
    const allowedTypes = document ? DOCUMENT_TYPES : SELFIE_TYPES;
    if (file.size > MAX_SIZE) throw new Error(`${name}: ${tr("arquivo maior que 8MB", "file is larger than 8MB")}`);
    if (!allowedTypes.includes(file.type)) {
      throw new Error(
        `${name}: ${tr(
          document ? "formato não aceito (use JPG, PNG, WEBP, GIF ou PDF)" : "formato não aceito (use JPG, PNG, WEBP ou GIF)",
          document ? "unsupported format (use JPG, PNG, WEBP, GIF or PDF)" : "unsupported format (use JPG, PNG, WEBP or GIF)",
        )}`,
      );
    }
    const extensionByType: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "application/pdf": "pdf",
    };
    const ext = extensionByType[file.type] ?? file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${user.id}/${crypto.randomUUID()}-${name}.${ext}`;
    const { error } = await supabase.storage.from("kyc").upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    return path;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!front || !selfie || !acceptedTerms || !confirmedAdult || !confirmedContentRights) {
      toast.error(tr("Preencha todos os campos obrigatórios.", "Complete all required fields."));
      return;
    }
    setLoading(true);
    const uploadedPaths: string[] = [];
    try {
      const frontPath = await upload(front, "front", true);
      uploadedPaths.push(frontPath);
      const backPath = back ? await upload(back, "back", true) : null;
      if (backPath) uploadedPaths.push(backPath);
      const selfiePath = await upload(selfie, "selfie");
      uploadedPaths.push(selfiePath);

      const identity = await verifyFn({
        data: {
          country,
          cpf: onlyDigits(cpf),
          full_name: fullName.trim(),
          phone: onlyDigits(phone),
          birth_date: birthDate,
          document_type: docType,
          document_front_path: frontPath,
          document_back_path: backPath,
          selfie_path: selfiePath,
        },
      });
      if (!identity.ok) throw new Error(identity.error);

      await submitKycFn({
        data: {
          documentType: docType,
          documentFrontPath: frontPath,
          documentBackPath: backPath,
          selfiePath,
          acceptedTerms: true,
          confirmedAdult: true,
          confirmedContentRights: true,
        },
      });
      toast.success(t("becomeCreator.kyc.success"));
      onDone();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      if (uploadedPaths.length > 0) {
        await supabase.storage.from("kyc").remove(uploadedPaths).catch(() => undefined);
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 rounded-2xl bg-card p-6">
      <StepProgress step={step} />

      {step === "personal" && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">{tr("Qual seu país de origem?", "What is your country?")}</h2>
          <div className="space-y-1.5">
            <Label>{tr("País", "Country")}</Label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="BR">Brasil</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="creator-cpf">CPF</Label>
            <Input
              id="creator-cpf"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpf}
              aria-invalid={Boolean(fieldErrors.cpf)}
              className={fieldErrors.cpf ? "border-destructive" : undefined}
              maxLength={14}
              onChange={(e) => {
                const formatted = formatCpf(e.target.value);
                setCpf(formatted);
                if (onlyDigits(formatted).length === 11) {
                  setFieldError("cpf", isValidCpf(formatted) ? null : tr("CPF inválido. Confira os números.", "Invalid CPF."));
                } else {
                  setFieldError("cpf", null);
                }
              }}
            />
            {fieldErrors.cpf && <p className="text-xs text-destructive">{fieldErrors.cpf}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="creator-name">{tr("Nome completo", "Full name")}</Label>
            <Input
              id="creator-name"
              placeholder={tr("Como no seu documento", "As on your document")}
              value={fullName}
              aria-invalid={Boolean(fieldErrors.fullName)}
              className={fieldErrors.fullName ? "border-destructive" : undefined}
              onChange={(e) => {
                setFullName(e.target.value);
                setFieldError("fullName", null);
              }}
              onBlur={() => {
                if (fullName.trim() && fullName.trim().split(/\s+/).length < 2) {
                  setFieldError("fullName", tr("Digite seu nome completo, como no documento.", "Enter your full name."));
                }
              }}
            />
            {fieldErrors.fullName && <p className="text-xs text-destructive">{fieldErrors.fullName}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="creator-birth">{tr("Data de nascimento", "Date of birth")}</Label>
            <Input
              id="creator-birth"
              type="date"
              value={birthDate}
              aria-invalid={Boolean(fieldErrors.birthDate)}
              className={fieldErrors.birthDate ? "border-destructive" : undefined}
              max="2099-12-31"
              onChange={(e) => {
                const value = e.target.value;
                setBirthDate(value);
                setFieldError("birthDate", value && !isAdult(value) ? tr("Você precisa ter 18 anos ou mais.", "You must be 18 or older.") : null);
              }}
            />
            {fieldErrors.birthDate && <p className="text-xs text-destructive">{fieldErrors.birthDate}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="creator-phone">{tr("Telefone com DDD", "Phone number")}</Label>
            <Input
              id="creator-phone"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="(11) 99999-9999"
              value={formatPhone(phone)}
              aria-invalid={Boolean(fieldErrors.phone)}
              className={fieldErrors.phone ? "border-destructive" : undefined}
              maxLength={15}
              onChange={(e) => {
                const digits = onlyPhoneDigits(e.target.value);
                setPhone(digits);
                if (digits.length >= 10) {
                  setFieldError("phone", isValidBrazilianPhone(digits) ? null : tr("Telefone inválido. Confira o DDD e o número.", "Invalid phone number."));
                } else {
                  setFieldError("phone", null);
                }
              }}
            />
            {fieldErrors.phone && <p className="text-xs text-destructive">{fieldErrors.phone}</p>}
          </div>
          <Button onClick={goToDocuments} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            {tr("Avançar", "Next")}
          </Button>
        </div>
      )}

      {step === "documents" && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">{t("becomeCreator.kyc.title")}</h2>
          <div>
            <Label>{t("becomeCreator.kyc.docType")}</Label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as "RG" | "CNH" | "Passport")}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="RG">RG</option>
              <option value="CNH">CNH</option>
              <option value="Passport">{tr("Passaporte", "Passport")}</option>
            </select>
          </div>
          <FileField label={t("becomeCreator.kyc.front")} onChange={setFront} accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" />
          <FileField label={t("becomeCreator.kyc.back")} onChange={setBack} optional accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" />
          <FileField label={t("becomeCreator.kyc.selfie")} onChange={setSelfie} accept="image/jpeg,image/png,image/webp,image/gif" />
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setStep("personal")}>
              {tr("Voltar", "Back")}
            </Button>
            <Button
              type="button"
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!front || !selfie}
              onClick={() => setStep("confirm")}
            >
              {tr("Avançar", "Next")}
            </Button>
          </div>
        </div>
      )}

      {step === "confirm" && (
        <form onSubmit={submit} className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">{tr("Confirme e envie", "Confirm and submit")}</h2>
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[oklch(0.72_0.19_47)]"
            />
            <span>
              {t("becomeCreator.kyc.terms")} {" "}
              <Link to="/terms" target="_blank" className="text-primary underline">{tr("Termos", "Terms")}</Link>
              {" "}{tr("e", "and")}{" "}
              <Link to="/privacy" target="_blank" className="text-primary underline">{tr("Privacidade", "Privacy")}</Link>.
              {" "}{tr("Também aceito a", "I also accept the")} {" "}
              <Link to="/content-policy" target="_blank" className="text-primary underline">
                {tr("Política de Conteúdo e Segurança", "Content and Safety Policy")}
              </Link>.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={confirmedAdult}
              onChange={(e) => setConfirmedAdult(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[oklch(0.72_0.19_47)]"
            />
            {tr(
              "Confirmo que tenho 18 anos ou mais e que meus documentos são verdadeiros.",
              "I confirm that I am at least 18 and that my documents are authentic.",
            )}
          </label>
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={confirmedContentRights}
              onChange={(e) => setConfirmedContentRights(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[oklch(0.72_0.19_47)]"
            />
            {tr(
              "Confirmo que só publicarei conteúdo próprio, consentido e com todas as pessoas retratadas maiores de 18 anos.",
              "I confirm I will only publish owned, consensual content featuring adults aged 18 or older.",
            )}
          </label>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setStep("documents")} disabled={loading}>
              {tr("Voltar", "Back")}
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
              {loading ? t("common.loading") : t("becomeCreator.kyc.submit")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function FileField({ label, onChange, optional, accept }: { label: string; onChange: (f: File | null) => void; optional?: boolean; accept: string }) {
  const { tr } = useI18n();
  return (
    <div>
      <Label>
        {label} {optional && <span className="text-xs text-muted-foreground">({tr("opcional", "optional")})</span>}
      </Label>
      <Input
        type="file"
        accept={accept}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="mt-1.5"
      />
    </div>
  );
}
