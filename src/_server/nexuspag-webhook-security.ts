const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

function hexToBytes(value: string): Uint8Array | null {
  if (!/^[a-f0-9]{64}$/i.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

export async function verifyNexusPagSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  nowSeconds = Date.now() / 1000,
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;
  const fields = new Map(
    signatureHeader.split(",").map((part) => {
      const separator = part.indexOf("=");
      return separator > 0
        ? [part.slice(0, separator).trim(), part.slice(separator + 1).trim()]
        : [part.trim(), ""];
    }),
  );
  const timestamp = Number(fields.get("t"));
  const suppliedSignature = hexToBytes(fields.get("v1") ?? "");
  if (
    !Number.isInteger(timestamp) ||
    Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS ||
    !suppliedSignature
  ) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    Uint8Array.from(suppliedSignature).buffer,
    encoder.encode(`${timestamp}.${rawBody}`),
  );
}
