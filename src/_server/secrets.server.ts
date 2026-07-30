export function secretsMatch(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;

  const encoder = new TextEncoder();
  const left = encoder.encode(provided);
  const right = encoder.encode(expected);
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return difference === 0;
}

export function unauthorizedResponse(): Response {
  return new Response("unauthorized", {
    status: 401,
    headers: { "Cache-Control": "no-store" },
  });
}
