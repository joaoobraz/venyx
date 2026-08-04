export const ACCOUNT_PAUSE_CHANGED_EVENT = "venyx:account-pause-changed";

export interface AccountPauseState {
  paused: boolean;
  pausedAt: string | null;
  reactivatedAt: string | null;
}

const STORAGE_PREFIX = "venyx:demo:account-pause:v1";

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`;
}

export function readDemoAccountPause(userId: string): AccountPauseState {
  if (typeof window === "undefined") {
    return { paused: false, pausedAt: null, reactivatedAt: null };
  }
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return { paused: false, pausedAt: null, reactivatedAt: null };
    const parsed = JSON.parse(raw) as Partial<AccountPauseState>;
    return {
      paused: parsed.paused === true,
      pausedAt: typeof parsed.pausedAt === "string" ? parsed.pausedAt : null,
      reactivatedAt:
        typeof parsed.reactivatedAt === "string" ? parsed.reactivatedAt : null,
    };
  } catch {
    return { paused: false, pausedAt: null, reactivatedAt: null };
  }
}

export function setDemoAccountPaused(userId: string, paused: boolean): AccountPauseState {
  const current = readDemoAccountPause(userId);
  const now = new Date().toISOString();
  const next: AccountPauseState = paused
    ? { paused: true, pausedAt: now, reactivatedAt: current.reactivatedAt }
    : { paused: false, pausedAt: current.pausedAt, reactivatedAt: now };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent(ACCOUNT_PAUSE_CHANGED_EVENT, { detail: { userId, state: next } }),
    );
  }
  return next;
}
