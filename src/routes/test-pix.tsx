import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Copy, CheckCircle2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  createPixCharge,
  getPixStatus,
} from "@/server/nexuspag.functions";

export const Route = createFileRoute("/test-pix")({
  component: TestPixPage,
});

type Charge = {
  id?: string;
  transaction_id?: string;
  external_id?: string;
  qr_code?: string;
  qr_code_base64?: string;
  expires_at?: string;
  status?: string;
  amount?: number;
  paid_at?: string;
  payer_name?: string;
};

function pickCharge(raw: any): Charge {
  // API may wrap as { data: { transaction: {...} } }, { data: {...} } or flat
  const d =
    raw?.data?.transaction ?? raw?.transaction ?? raw?.data ?? raw ?? {};
  return {
    id: d.id ?? d.transaction_id ?? d.txid,
    transaction_id: d.transaction_id ?? d.id,
    external_id: d.external_id,
    qr_code: d.pix_copia_cola ?? d.qr_code ?? d.pix_copy_paste ?? d.copy_paste,
    qr_code_base64: d.qr_code_base64 ?? d.qr_code_image,
    expires_at: d.expires_at,
    status: d.status,
    amount: d.amount,
    paid_at: d.paid_at,
    payer_name: d.payer_name,
  };
}

function TestPixPage() {
  const { user, isSeller, isAdmin, loading: authLoading } = useAuth();
  const create = useServerFn(createPixCharge);
  const status = useServerFn(getPixStatus);

  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState<string>("1.00");
  const [charge, setCharge] = useState<Charge | null>(null);
  const [rawCreate, setRawCreate] = useState<any>(null);
  const [rawStatus, setRawStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []);

  const handleCreate = async () => {
    const value = Number(String(amount).replace(",", "."));
    if (!value || value <= 0 || isNaN(value)) {
      setError("Informe um valor válido maior que zero.");
      return;
    }

    setLoading(true);
    setError(null);
    setCharge(null);
    setRawCreate(null);
    setRawStatus(null);
    stopPolling();

    try {
      const res = await create({
        data: {
          amount: value,
          description: `PIX R$ ${value.toFixed(2)}`,
          external_id: `test-${Date.now()}`,
        },
      });

      setRawCreate(res);

      if (!res.ok) {
        setError(
          `Erro ${res.status}: ${JSON.stringify(res.error)}`,
        );
        return;
      }

      const c = pickCharge(res.data);
      setCharge(c);

      if (!c.id) {
        setError("Cobrança criada mas sem ID retornado — veja o JSON abaixo.");
        return;
      }

      // start polling status every 4s
      pollRef.current = setInterval(async () => {
        try {
          const s = await status({ data: { id: c.id! } });
          setRawStatus(s);
          if (s.ok) {
            const updated = pickCharge(s.data);
            setCharge((prev) => ({ ...prev, ...updated }));
            if (updated.status === "paid") {
              stopPolling();
              toast.success("Pagamento confirmado! 🎉");
            } else if (
              updated.status === "expired" ||
              updated.status === "cancelled"
            ) {
              stopPolling();
            }
          }
        } catch (e) {
          console.error("poll err", e);
        }
      }, 4000);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    if (!charge?.qr_code) return;
    await navigator.clipboard.writeText(charge.qr_code);
    toast.success("Código PIX copiado");
  };

  const qrSrc = charge?.qr_code_base64
    ? charge.qr_code_base64.startsWith("data:")
      ? charge.qr_code_base64
      : `data:image/png;base64,${charge.qr_code_base64}`
    : null;

  return (
    <div className="container mx-auto max-w-xl py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gerar PIX</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Informe o valor e gere uma cobrança PIX. O status é consultado a cada 4s.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Valor (R$)</label>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={loading}
          className="w-full px-3 py-2 border rounded bg-background"
          placeholder="0,00"
        />
      </div>

      <Button onClick={handleCreate} disabled={loading} size="lg">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Gerar PIX
      </Button>

      {error && (
        <Card className="p-4 border-destructive">
          <p className="text-sm font-medium text-destructive">Erro</p>
          <pre className="text-xs mt-2 whitespace-pre-wrap break-all">
            {error}
          </pre>
        </Card>
      )}

      {charge && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-semibold flex items-center gap-2">
                {charge.status === "paid" ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Pago
                  </>
                ) : (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {charge.status ?? "pending"}
                  </>
                )}
              </p>
            </div>
            {charge.amount && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Valor</p>
                <p className="font-semibold">
                  R$ {Number(charge.amount).toFixed(2)}
                </p>
              </div>
            )}
          </div>

          {qrSrc && charge.status !== "paid" && (
            <div className="flex justify-center">
              <img
                src={qrSrc}
                alt="QR Code PIX"
                className="w-64 h-64 border rounded"
              />
            </div>
          )}

          {charge.qr_code && charge.status !== "paid" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">PIX copia-e-cola</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={charge.qr_code}
                  className="flex-1 text-xs px-2 py-1 border rounded bg-muted"
                />
                <Button size="sm" variant="outline" onClick={copyCode}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
            {charge.id && <p>ID: {charge.id}</p>}
            {charge.external_id && <p>External: {charge.external_id}</p>}
            {charge.expires_at && <p>Expira: {charge.expires_at}</p>}
            {charge.paid_at && <p>Pago em: {charge.paid_at}</p>}
            {charge.payer_name && <p>Pagador: {charge.payer_name}</p>}
          </div>
        </Card>
      )}

      {(rawCreate || rawStatus) && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            Debug (resposta bruta da API)
          </summary>
          <div className="mt-2 space-y-2">
            {rawCreate && (
              <div>
                <p className="font-mono">POST /api/pix/create</p>
                <pre className="bg-muted p-2 rounded overflow-auto max-h-60">
                  {JSON.stringify(rawCreate, null, 2)}
                </pre>
              </div>
            )}
            {rawStatus && (
              <div>
                <p className="font-mono">GET /api/pix/{`{id}`}</p>
                <pre className="bg-muted p-2 rounded overflow-auto max-h-60">
                  {JSON.stringify(rawStatus, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
