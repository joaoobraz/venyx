export type InternalPendingCharge = {
  amount_cents: number;
  external_id: string;
  gateway_transaction_id: string | null;
};

export type NormalizedGatewayCharge = {
  status: string | null;
  amountCents: number | null;
  externalId: string | null;
  transactionIds: string[];
  paidAt: string | null;
  payerName: string | null;
};

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function unwrapGatewayCharge(raw: unknown): Record<string, unknown> {
  const root = objectOf(raw);
  const data =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? objectOf(root.data)
      : null;
  return objectOf(data?.transaction ?? root.transaction ?? data ?? root);
}

export function normalizeGatewayCharge(raw: unknown): NormalizedGatewayCharge {
  const value = unwrapGatewayCharge(raw);
  const items = Array.isArray(value.items) ? value.items.map(objectOf) : [];
  const firstItem = items[0] ?? {};
  const product = objectOf(firstItem.product);
  const payer = objectOf(value.payer);
  const customer = objectOf(value.customer);
  const transactionIds = [value.id, value.transaction_id, value.txid]
    .filter((item): item is string => typeof item === "string" && item.length > 0);
  const amount = typeof value.amount === "number" ? value.amount : Number(value.amount);
  const externalRef = value.external_ref ?? firstItem.external_ref ?? product.external_ref;
  const payerName = payer.name ?? value.payer_name ?? customer.name;

  return {
    status: typeof value.status === "string" ? value.status.toLowerCase() : null,
    amountCents: Number.isInteger(amount) ? amount : null,
    externalId: typeof externalRef === "string" ? externalRef : null,
    transactionIds: Array.from(new Set(transactionIds)),
    paidAt: typeof value.paid_at === "string" ? value.paid_at : null,
    payerName: typeof payerName === "string" ? payerName : null,
  };
}

export function compareGatewayCharge(
  local: InternalPendingCharge,
  gateway: NormalizedGatewayCharge,
) {
  return {
    amountMatches: gateway.amountCents === local.amount_cents,
    externalIdMatches: gateway.externalId === local.external_id,
    transactionMatches:
      Boolean(local.gateway_transaction_id) &&
      gateway.transactionIds.includes(local.gateway_transaction_id ?? ""),
  };
}

export function gatewayConfirmationIsSafe(
  local: InternalPendingCharge,
  gateway: NormalizedGatewayCharge,
) {
  if (gateway.status !== "paid") return false;
  const comparison = compareGatewayCharge(local, gateway);
  return comparison.amountMatches && comparison.externalIdMatches && comparison.transactionMatches;
}

export function sanitizedGatewayDetails(gateway: NormalizedGatewayCharge) {
  return {
    status: gateway.status,
    amount_cents: gateway.amountCents,
    external_id: gateway.externalId,
    transaction_ids: gateway.transactionIds,
    paid_at: gateway.paidAt,
  };
}
