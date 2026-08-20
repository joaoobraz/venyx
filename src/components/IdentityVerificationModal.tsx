import { useState } from "react";
import { ShieldCheck, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { verifyIdentity } from "@/_server/verification.functions";
import { formatCpf, isValidCpf, isAdult, onlyDigits } from "@/lib/cpf";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Verificação de identidade exigida ao assinar conteúdo de uma criadora.
 * Visual próprio da Fanlira (inspirado em fluxos do mercado, sem cópia).
 */
export function IdentityVerificationModal({
  open,
  onOpenChange,
  onVerified,
  onPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onVerified: () => void;
  onPending?: () => void;
}) {
  const { user, session } = useAuth();
  const verifyFn = useServerFn(verifyIdentity);

  const [country, setCountry] = useState("BR");
  const [cpf, setCpf] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [documentType, setDocumentType] = useState<"RG" | "CNH" | "Passport">("RG");
  const [documentFront, setDocumentFront] = useState<File | null>(null);
  const [documentBack, setDocumentBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);

    if (!isValidCpf(cpf)) {
      setError("CPF inválido. Confira os números.");
      return;
    }
    if (fullName.trim().split(/\s+/).length < 2) {
      setError("Digite seu nome completo, como no documento.");
      return;
    }
    if (!/^\d{10,11}$/.test(onlyDigits(phone))) {
      setError("Informe um telefone válido com DDD.");
      return;
    }
    if (!birthDate) {
      setError("Informe sua data de nascimento.");
      return;
    }
    if (!isAdult(birthDate)) {
      setError("Você precisa ter 18 anos ou mais para acessar este conteúdo.");
      return;
    }
    if (!documentFront || !selfie) {
      setError("Envie a frente do documento e uma selfie atual.");
      return;
    }

    const authHeaders = session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : null;
    if (!authHeaders || !user) {
      setError("Faça login para continuar.");
      return;
    }

    setBusy(true);
    try {
      const upload = async (file: File, label: string) => {
        const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic"];
        if (!allowed.includes(file.type)) {
          throw new Error(`${label}: use JPG, PNG ou WEBP.`);
        }
        if (file.size <= 0 || file.size > 8 * 1024 * 1024) {
          throw new Error(`${label}: o arquivo deve ter até 8 MB.`);
        }
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/age-${crypto.randomUUID()}-${label}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("kyc").upload(path, file, {
          upsert: false,
          contentType: file.type,
        });
        if (uploadError) throw uploadError;
        return path;
      };

      const documentFrontPath = await upload(documentFront, "front");
      const documentBackPath = documentBack ? await upload(documentBack, "back") : null;
      const selfiePath = await upload(selfie, "selfie");
      const res = await verifyFn({
        data: {
          country,
          cpf: onlyDigits(cpf),
          full_name: fullName.trim(),
          phone: onlyDigits(phone),
          birth_date: birthDate,
          document_type: documentType,
          document_front_path: documentFrontPath,
          document_back_path: documentBackPath,
          selfie_path: selfiePath,
        },
        headers: authHeaders,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.status === "pending") {
        toast.success("Documentos enviados para análise manual.");
        onOpenChange(false);
        onPending?.();
        return;
      }
      toast.success("Identidade confirmada! ✅");
      onOpenChange(false);
      onVerified();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao verificar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent" />
            Confirme suas informações
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Para acessar conteúdo de criadoras, precisamos confirmar que você é maior de 18 anos. Seus
          dados são usados apenas para verificação e ficam protegidos.
        </p>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span className="text-foreground">{error}</span>
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>País</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BR">Brasil</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => {
                setCpf(formatCpf(e.target.value));
                setError(null);
              }}
              maxLength={14}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="full_name">Nome completo</Label>
            <Input
              id="full_name"
              placeholder="Como no seu documento"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setError(null);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefone com DDD</Label>
            <Input
              id="phone"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="11999999999"
              value={phone}
              onChange={(e) => {
                setPhone(onlyDigits(e.target.value).slice(0, 11));
                setError(null);
              }}
              maxLength={11}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="birth_date">Data de nascimento</Label>
            <Input
              id="birth_date"
              type="date"
              value={birthDate}
              onChange={(e) => {
                setBirthDate(e.target.value);
                setError(null);
              }}
              max="2099-12-31"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Documento</Label>
            <Select
              value={documentType}
              onValueChange={(value) => setDocumentType(value as "RG" | "CNH" | "Passport")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RG">RG</SelectItem>
                <SelectItem value="CNH">CNH</SelectItem>
                <SelectItem value="Passport">Passaporte</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <VerificationFile
            label="Frente do documento"
            file={documentFront}
            onChange={setDocumentFront}
          />
          <VerificationFile
            label="Verso do documento (opcional)"
            file={documentBack}
            onChange={setDocumentBack}
          />
          <VerificationFile label="Selfie atual" file={selfie} onChange={setSelfie} />
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
            onClick={submit}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VerificationFile({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      {file && <p className="truncate text-[11px] text-muted-foreground">{file.name}</p>}
    </div>
  );
}
