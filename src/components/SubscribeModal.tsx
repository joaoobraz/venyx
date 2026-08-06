import { useEffect, useRef, useState } from "react";
import { Crown, Loader2, Gift, Tag, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { listCreatorOffers } from "@/_server/upsells.functions";
import { createSubscriptionPixCharge, getChargeStatus } from "@/_server/checkout.functions";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { UpsellModal } from "@/components/UpsellModal";
import { startTrial, checkTrialEligibility } from "@/_server/trial.functions";
import { IdentityVerificationModal } from "@/components/IdentityVerificationModal";
import { getMyVerificationStatus } from "@/_server/verification.functions";
import { previewOnlyMessage } from "@/lib/creator-profile-preview";
import { useI18n } from "@/lib/i18n";

interface Plan {
  id: string;
  months: number;
  price_cents: number;
  discount_pct: number;
}

interface CouponInfo {
  id: string;
  code: string;
  offer_type: string;
  trial_days: number | null;
  discount_pct: number | null;
  discount_amount_cents: number | null;
  fixed_price_cents: number | null;
  normal_price_snapshot_cents: number | null;
  post_trial_price_cents: number | null;
  auto_renew_after_trial: boolean;
  duration_months: number;
  max_uses: number;
  uses_count: number;
  expires_at: string | null;
  new_subscribers_only: boolean;
}

interface BumpOffer {
  id: string;
  title: string;
  description: string | null;
  price_cents: number;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

type Step = "plan" | "pix" | "done";

export function SubscribeModal({
  open,
  onOpenChange,
  creatorId,
  creatorName,
  basePriceCents,
  onSubscribed,
  previewOnly = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  creatorId: string;
  creatorName: string;
  basePriceCents: number;
  onSubscribed?: () => void;
  previewOnly?: boolean;
}) {
  const { user, session, accountPaused } = useAuth();
  const { locale } = useI18n();
  const createChargeFn = useServerFn(createSubscriptionPixCharge);
  const getStatusFn = useServerFn(getChargeStatus);
  const listOffersFn = useServerFn(listCreatorOffers);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [bumps, setBumps] = useState<BumpOffer[]>([]);
  const [selectedBumps, setSelectedBumps] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<number>(1);
  const [coupon, setCoupon] = useState<CouponInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>("plan");
  const [pix, setPix] = useState<{
    chargeId: string;
    qrCode: string | null;
    qrCodeBase64: string | null;
    amountCents: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [trialInfo, setTrialInfo] = useState<{ eligible: boolean; days: number }>({
    eligible: false,
    days: 0,
  });
  const [trialBusy, setTrialBusy] = useState(false);
  const startTrialFn = useServerFn(startTrial);
  const checkTrialFn = useServerFn(checkTrialEligibility);
  const checkVerifyFn = useServerFn(getMyVerificationStatus);
  const [verified, setVerified] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const afterVerifyRef = useRef<null | (() => void)>(null);

  // reset on close
  useEffect(() => {
    if (!open) {
      setStep("plan");
      setPix(null);
      setSelectedBumps(new Set());
      setCopied(false);
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [open]);

  // load plans + bumps + coupon
  useEffect(() => {
    if (!open) return;

    supabase
      .from("subscription_plans")
      .select("*")
      .eq("creator_id", creatorId)
      .eq("is_active", true)
      .order("months", { ascending: true })
      .then(({ data }) => {
        const list = (data as Plan[]) ?? [];
        if (list.length === 0 && basePriceCents > 0) {
          setPlans(
            previewOnly
              ? [
                  {
                    id: "preview-monthly",
                    months: 1,
                    price_cents: basePriceCents,
                    discount_pct: 0,
                  },
                  {
                    id: "preview-quarterly",
                    months: 3,
                    price_cents: Math.round(basePriceCents * 0.9),
                    discount_pct: 10,
                  },
                  {
                    id: "preview-semester",
                    months: 6,
                    price_cents: Math.round(basePriceCents * 0.8),
                    discount_pct: 20,
                  },
                  {
                    id: "preview-annual",
                    months: 12,
                    price_cents: Math.round(basePriceCents * 0.7),
                    discount_pct: 30,
                  },
                ]
              : [
                  {
                    id: "default",
                    months: 1,
                    price_cents: basePriceCents,
                    discount_pct: 0,
                  },
                ],
          );
        } else {
          setPlans(list);
        }
        setSelected(list[0]?.months ?? 1);
      });

    listOffersFn({ data: { creatorId, kind: "order_bump" } })
      .then((res) => {
        setBumps((res.offers as unknown as BumpOffer[]) ?? []);
      })
      .catch(() => setBumps([]));

    const code = readCookie("venyx_coupon");
    if (code) {
      supabase
        .from("subscription_coupons")
        .select("*")
        .eq("code", code)
        .eq("creator_id", creatorId)
        .eq("is_active", true)
        .maybeSingle()
        .then(({ data }) => {
          if (
            data &&
            (!(data as CouponInfo).expires_at ||
              new Date((data as CouponInfo).expires_at as string).getTime() > Date.now()) &&
            ((data as CouponInfo).max_uses === 0 ||
              (data as CouponInfo).uses_count < (data as CouponInfo).max_uses)
          ) {
            setCoupon(data as CouponInfo);
            if (!(data as CouponInfo).trial_days) {
              setSelected((data as CouponInfo).duration_months);
            }
          }
        });
    }
  }, [open, creatorId, basePriceCents, listOffersFn, previewOnly]);

  useEffect(() => {
    if (!open || !user || previewOnly) return;
    checkTrialFn({ data: { creatorId } })
      .then((res) => {
        if (res.eligible) setTrialInfo({ eligible: true, days: res.trialDays ?? 0 });
        else setTrialInfo({ eligible: false, days: 0 });
      })
      .catch(() => setTrialInfo({ eligible: false, days: 0 }));
  }, [open, user, creatorId, checkTrialFn, previewOnly]);

  // verifica se o usuário já passou pela verificação de identidade (+18)
  useEffect(() => {
    if (!open || !user) {
      setVerified(false);
      return;
    }
    const authHeaders = session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : undefined;
    checkVerifyFn({ headers: authHeaders })
      .then((r) => setVerified(!!r.verified))
      .catch(() => setVerified(false));
  }, [open, user, session, checkVerifyFn]);

  // garante a verificação antes de executar a ação (assinar / trial)
  const ensureVerifiedThen = (action: () => void) => {
    if (previewOnly) {
      action();
      return;
    }
    if (user && !verified) {
      afterVerifyRef.current = action;
      setShowVerify(true);
    } else {
      action();
    }
  };

  const activateTrial = async () => {
    if (previewOnly) {
      toast.info(previewOnlyMessage(locale));
      return;
    }
    if (accountPaused) {
      toast.info("Reative sua conta antes de iniciar uma assinatura.");
      return;
    }
    setTrialBusy(true);
    try {
      const res = await startTrialFn({ data: { creatorId } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Trial de ${res.trialDays} dias ativado! 🎁`);
      onSubscribed?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao iniciar trial");
    } finally {
      setTrialBusy(false);
    }
  };

  const plan = plans.find((p) => p.months === selected) ?? plans[0];
  const subSubtotal = plan ? plan.price_cents * plan.months : 0;
  const couponApplies =
    !!coupon && (!!coupon.trial_days || coupon.duration_months === plan?.months);
  const subDiscounted =
    couponApplies && coupon?.fixed_price_cents
      ? coupon.fixed_price_cents
      : couponApplies && coupon?.discount_amount_cents
        ? Math.max(100, subSubtotal - coupon.discount_amount_cents)
        : couponApplies && coupon?.discount_pct
          ? Math.round(subSubtotal * (1 - coupon.discount_pct / 100))
          : subSubtotal;
  const isTrial = couponApplies && !!coupon?.trial_days;
  const postOfferCents = isTrial ? (coupon?.post_trial_price_cents ?? subSubtotal) : subSubtotal;
  const bumpsTotal = bumps
    .filter((b) => selectedBumps.has(b.id))
    .reduce((s, b) => s + b.price_cents, 0);
  const totalCents = (isTrial ? 0 : subDiscounted) + bumpsTotal;

  const toggleBump = (id: string) => {
    setSelectedBumps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startCheckout = async () => {
    if (!plan) return;
    if (previewOnly) {
      toast.info(previewOnlyMessage(locale));
      return;
    }
    if (accountPaused) {
      toast.info("Reative sua conta antes de iniciar uma assinatura.");
      return;
    }
    const authHeaders = session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : null;
    if (!user || !authHeaders) {
      toast.error("Faça login para assinar.");
      return;
    }
    setBusy(true);
    try {
      const res = await createChargeFn({
        data: {
          creatorId,
          months: plan.months,
          pricePerMonthCents: plan.price_cents,
          couponCode: couponApplies ? (coupon?.code ?? null) : null,
          bumpOfferIds: Array.from(selectedBumps),
        },
        headers: authHeaders,
      });

      if ("ok" in res && res.ok === false) {
        toast.error(res.error || "Não foi possível gerar o Pix. Tente novamente.");
        return;
      }

      if ("freeTrialActivated" in res && res.freeTrialActivated) {
        toast.success(`Trial de ${res.trialDays} dias ativado!`);
        if (coupon) document.cookie = "venyx_coupon=; path=/; max-age=0; SameSite=Lax; Secure";
        onSubscribed?.();
        onOpenChange(false);
        // tenta abrir upsell mesmo após trial
        setTimeout(() => setUpsellOpen(true), 400);
        return;
      }

      if ("chargeId" in res) {
        setPix({
          chargeId: res.chargeId,
          qrCode: res.qrCode,
          qrCodeBase64: res.qrCodeBase64,
          amountCents: res.amountCents,
        });
        setStep("pix");
        // inicia polling
        pollRef.current = setInterval(async () => {
          try {
            const s = await getStatusFn({ data: { chargeId: res.chargeId }, headers: authHeaders });
            if (s.status === "paid") {
              if (pollRef.current) clearInterval(pollRef.current);
              setStep("done");
              if (coupon)
                document.cookie = "venyx_coupon=; path=/; max-age=0; SameSite=Lax; Secure";
              toast.success("Pagamento confirmado! Você já é assinante.");
              onSubscribed?.();
              onOpenChange(false);
              setTimeout(() => setUpsellOpen(true), 500);
            } else if (s.status === "expired" || s.status === "cancelled") {
              if (pollRef.current) clearInterval(pollRef.current);
              toast.error("Este Pix expirou. Gere uma nova cobrança.");
              setStep("plan");
              setPix(null);
            }
          } catch (e) {
            console.error(e);
          }
        }, 4000);
      }
    } catch (e) {
      console.error("[SubscribeModal] checkout error", e);
      if (e instanceof Response) {
        if (e.status === 401) {
          toast.error("Faça login para assinar.");
        } else {
          const txt = await e.text().catch(() => "");
          toast.error(txt || `Erro ${e.status}`);
        }
      } else {
        const message = e instanceof Error ? e.message : "Erro ao iniciar pagamento";
        if (message.toLowerCase().includes("vagas desta oferta acabaram")) {
          document.cookie = "venyx_coupon=; path=/; max-age=0; SameSite=Lax; Secure";
          setCoupon(null);
          toast.info("A promoção terminou. O valor normal do plano já foi restaurado.");
        } else {
          toast.error(message);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const copyPix = () => {
    if (!pix?.qrCode) return;
    navigator.clipboard.writeText(pix.qrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-accent" />
              {step === "pix" ? "Pague com Pix" : `Assinar ${creatorName}`}
            </DialogTitle>
          </DialogHeader>

          {previewOnly && (
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs leading-5 text-muted-foreground">
              <strong className="block text-foreground">Prévia do processo de assinatura</strong>
              Escolha os períodos e veja os valores como um cliente. A etapa de pagamento está
              bloqueada e nenhum Pix será gerado.
            </div>
          )}

          {step === "plan" && (
            <div className="space-y-3">
              {trialInfo.eligible && (
                <div className="space-y-2 rounded-xl border-2 border-accent/50 bg-gradient-to-br from-accent/15 to-primary/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <Gift className="h-5 w-5 text-accent" />
                    🎁 {trialInfo.days} {trialInfo.days === 1 ? "dia grátis" : "dias grátis"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Experimente sem pagar. Cancele a qualquer momento antes do término.
                  </p>
                  <Button
                    onClick={() => ensureVerifiedThen(activateTrial)}
                    disabled={trialBusy}
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {trialBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      `Começar ${trialInfo.days} ${trialInfo.days === 1 ? "dia" : "dias"} grátis`
                    )}
                  </Button>
                  <p className="text-center text-[10px] text-muted-foreground">
                    — ou escolha um plano abaixo —
                  </p>
                </div>
              )}
              {coupon && couponApplies && (
                <div className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    {isTrial ? (
                      <Gift className="h-4 w-4 text-accent" />
                    ) : (
                      <Tag className="h-4 w-4 text-accent" />
                    )}
                    <span>
                      {isTrial
                        ? `🎁 ${coupon.trial_days} dias grátis aplicados`
                        : coupon.offer_type === "fixed_discount"
                          ? `🏷️ R$ ${((coupon.discount_amount_cents ?? 0) / 100).toFixed(2)} de desconto aplicado`
                          : coupon.fixed_price_cents
                            ? `🏷️ Oferta por R$ ${(coupon.fixed_price_cents / 100).toFixed(2)}`
                            : `🏷️ ${coupon.discount_pct}% de desconto aplicado`}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                    {!isTrial && (
                      <span>
                        De <s>R$ {(subSubtotal / 100).toFixed(2)}</s> por{" "}
                        <strong className="text-primary">
                          R$ {(subDiscounted / 100).toFixed(2)}
                        </strong>
                      </span>
                    )}
                    <span>
                      Depois:{" "}
                      <strong className="text-foreground">
                        R$ {(postOfferCents / 100).toFixed(2)}
                      </strong>
                    </span>
                  </div>
                  {isTrial && (
                    <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
                      {coupon.auto_renew_after_trial
                        ? "A renovação automática depende de autorização válida de cobrança recorrente; Pix avulso não é cobrado automaticamente."
                        : "Ao final do teste, uma nova confirmação será necessária para assinar."}
                    </p>
                  )}
                </div>
              )}
              {plans.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Esta criadora ainda não definiu planos.
                </p>
              ) : (
                <div className="space-y-2">
                  {plans.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelected(p.months)}
                      className={`flex w-full items-center justify-between rounded-xl border-2 p-3 text-left transition-all ${
                        selected === p.months
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:border-primary/50"
                      }`}
                    >
                      <div>
                        <div className="text-sm font-bold text-foreground">
                          {p.months} {p.months === 1 ? "mês" : "meses"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          R$ {(p.price_cents / 100).toFixed(2)}/mês
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold text-primary">
                          R$ {((p.price_cents * p.months) / 100).toFixed(2)}
                        </div>
                        {p.discount_pct > 0 && (
                          <div className="text-[10px] font-semibold text-accent">
                            -{p.discount_pct}%
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {bumps.length > 0 && (
                <div className="space-y-2 rounded-xl border-2 border-dashed border-accent/40 bg-accent/5 p-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-accent">
                    <Gift className="h-4 w-4" /> Aproveite e leve junto
                  </div>
                  {bumps.map((b) => (
                    <label
                      key={b.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                        selectedBumps.has(b.id)
                          ? "border-accent bg-accent/10"
                          : "border-border bg-card hover:border-accent/50"
                      }`}
                    >
                      <Checkbox
                        checked={selectedBumps.has(b.id)}
                        onCheckedChange={() => toggleBump(b.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-foreground">{b.title}</span>
                          <span className="text-sm font-bold text-accent">
                            + R$ {(b.price_cents / 100).toFixed(2)}
                          </span>
                        </div>
                        {b.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{b.description}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {plan && (
                <div className="flex items-center justify-between rounded-xl bg-muted p-3 text-sm">
                  <span className="text-muted-foreground">Total a pagar agora</span>
                  <span className="text-lg font-bold text-foreground">
                    {totalCents === 0 ? "GRÁTIS" : `R$ ${(totalCents / 100).toFixed(2)}`}
                  </span>
                </div>
              )}

              <Button
                onClick={() => ensureVerifiedThen(startCheckout)}
                disabled={busy || !plan}
                className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : totalCents === 0 ? (
                  "Iniciar trial grátis"
                ) : previewOnly ? (
                  "Continuar na prévia"
                ) : (
                  "Pagar com Pix"
                )}
              </Button>
            </div>
          )}

          {step === "pix" && pix && (
            <div className="space-y-3">
              <div className="rounded-xl bg-muted p-3 text-center text-sm">
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="text-2xl font-bold text-foreground">
                  R$ {(pix.amountCents / 100).toFixed(2)}
                </div>
              </div>

              {pix.qrCode ? (
                <div className="flex justify-center">
                  <div className="rounded-lg border bg-white p-3">
                    <QRCodeSVG value={pix.qrCode} size={208} level="M" />
                  </div>
                </div>
              ) : pix.qrCodeBase64 ? (
                <div className="flex justify-center">
                  <img
                    src={
                      pix.qrCodeBase64.startsWith("data:") || pix.qrCodeBase64.startsWith("http")
                        ? pix.qrCodeBase64
                        : `data:image/png;base64,${pix.qrCodeBase64}`
                    }
                    alt="QR Code Pix"
                    className="h-56 w-56 rounded-lg border bg-white p-2"
                  />
                </div>
              ) : null}

              {pix.qrCode && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Ou copie o código Pix:</p>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={pix.qrCode}
                      className="flex-1 rounded-lg border bg-muted px-2 py-1.5 text-xs font-mono"
                    />
                    <Button size="sm" variant="outline" onClick={copyPix}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Aguardando pagamento…
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <UpsellModal
        open={!previewOnly && upsellOpen}
        onOpenChange={setUpsellOpen}
        creatorId={creatorId}
        creatorName={creatorName}
      />

      <IdentityVerificationModal
        open={!previewOnly && showVerify}
        onOpenChange={setShowVerify}
        onVerified={() => {
          setVerified(true);
          const action = afterVerifyRef.current;
          afterVerifyRef.current = null;
          action?.();
        }}
      />
    </>
  );
}
