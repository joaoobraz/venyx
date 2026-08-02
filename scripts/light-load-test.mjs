const baseUrl = process.env.VENYX_LOAD_BASE_URL ?? "http://localhost:8080";
const total = Number(process.env.VENYX_LOAD_REQUESTS ?? 120);
const concurrency = Number(process.env.VENYX_LOAD_CONCURRENCY ?? 12);
const timeoutMs = Number(process.env.VENYX_LOAD_TIMEOUT_MS ?? 5_000);
const targets = ["/", "/api/public/health"];

if (!Number.isInteger(total) || total < 10 || total > 2_000) throw new Error("VENYX_LOAD_REQUESTS must be between 10 and 2000");
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 50) throw new Error("VENYX_LOAD_CONCURRENCY must be between 1 and 50");

const durations = [];
const failures = [];
let cursor = 0;

async function requestOne(index) {
  const path = targets[index % targets.length];
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { "user-agent": "venyx-local-readiness-check/1.0" },
      signal: controller.signal,
    });
    durations.push(performance.now() - started);
    if (!response.ok) failures.push({ path, status: response.status });
    await response.arrayBuffer();
  } catch (error) {
    durations.push(performance.now() - started);
    failures.push({ path, error: error instanceof Error ? error.name : "unknown" });
  } finally {
    clearTimeout(timer);
  }
}

async function worker() {
  while (cursor < total) {
    const index = cursor++;
    await requestOne(index);
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
durations.sort((a, b) => a - b);
const percentile = (p) => durations[Math.min(durations.length - 1, Math.ceil(durations.length * p) - 1)] ?? 0;
const failureRate = failures.length / total;

console.log(JSON.stringify({
  baseUrl,
  requests: total,
  concurrency,
  failures: failures.length,
  failureRatePercent: Math.round(failureRate * 10_000) / 100,
  p50Ms: Math.round(percentile(0.5)),
  p95Ms: Math.round(percentile(0.95)),
  p99Ms: Math.round(percentile(0.99)),
  sampleFailures: failures.slice(0, 5),
}, null, 2));

if (failureRate > 0.01 || percentile(0.95) > 2_000) process.exitCode = 1;
