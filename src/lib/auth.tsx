import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "subscriber" | "creator" | "admin" | "ambassador" | "seller";
export type DemoPreviewRole = Extract<AppRole, "subscriber" | "creator" | "admin">;

export interface Profile {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  is_verified: boolean;
  subscription_price_cents: number | null;
}

export interface KycRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  kyc: KycRequest | null;
  loading: boolean;
  isCreator: boolean;
  isAdmin: boolean;
  isAmbassador: boolean;
  isSeller: boolean;
  mfaEnabled: boolean;
  canUseDemoPreview: boolean;
  demoPreviewRole: DemoPreviewRole | null;
  setDemoPreviewRole: (role: DemoPreviewRole | null) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);
const DEMO_PREVIEW_STORAGE_KEY = "venyx:demo-preview-role";
const DEFAULT_DEMO_PREVIEW_EMAIL = "joaobraz.ofc@gmail.com";
const DEMO_PREVIEW_ROLES: DemoPreviewRole[] = ["subscriber", "creator", "admin"];

function previewStorageKey(email: string) {
  return `${DEMO_PREVIEW_STORAGE_KEY}:${email.toLowerCase()}`;
}

function isDemoPreviewAllowed(email?: string) {
  if (!email) return false;
  const localPreviewAccess =
    import.meta.env.DEV &&
    import.meta.env.VITE_ENABLE_LOCAL_PREVIEW_ACCESS === "true" &&
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (localPreviewAccess) return true;

  const enabled =
    import.meta.env.VITE_APP_ENV === "staging" &&
    import.meta.env.VITE_ENABLE_DEMO_PREVIEW === "true";
  if (!enabled) return false;

  const allowlist = (
    import.meta.env.VITE_DEMO_PREVIEW_EMAILS || DEFAULT_DEMO_PREVIEW_EMAIL
  )
    .split(",")
    .map((entry: string) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.trim().toLowerCase());
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [kyc, setKyc] = useState<KycRequest | null>(null);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [demoPreviewRole, setDemoPreviewRoleState] = useState<DemoPreviewRole | null>(null);
  const canUseDemoPreview = isDemoPreviewAllowed(user?.email);

  const setDemoPreviewRole = (role: DemoPreviewRole | null) => {
    if (!canUseDemoPreview || !user?.email || typeof window === "undefined") return;
    if (role && !DEMO_PREVIEW_ROLES.includes(role)) return;
    const key = previewStorageKey(user.email);
    if (role) {
      window.localStorage.setItem(key, role);
    } else {
      window.localStorage.removeItem(key);
    }
    setDemoPreviewRoleState(role);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(DEMO_PREVIEW_STORAGE_KEY);
    if (!canUseDemoPreview || !user?.email) {
      setDemoPreviewRoleState(null);
      return;
    }
    const saved = window.localStorage.getItem(previewStorageKey(user.email)) as DemoPreviewRole | null;
    setDemoPreviewRoleState(saved && DEMO_PREVIEW_ROLES.includes(saved) ? saved : null);
  }, [canUseDemoPreview, user?.email]);

  const loadUserData = async (uid: string) => {
    const [{ data: prof }, { data: roleRows }, { data: kycRow }, { data: factors }] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase
          .from("kyc_requests")
          .select("id,status,rejection_reason")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.auth.mfa.listFactors(),
      ]);
    setProfile((prof as Profile) ?? null);
    setRoles(((roleRows ?? []) as { role: AppRole }[]).map((r) => r.role));
    setKyc((kycRow as KycRequest) ?? null);
    setMfaEnabled((factors?.all ?? []).some((factor) => factor.status === "verified"));
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => {
          loadUserData(sess.user.id);
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
        setKyc(null);
        setMfaEnabled(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        loadUserData(sess.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = async () => {
    if (user) await loadUserData(user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        profile,
        roles,
        kyc,
        loading,
        isCreator: roles.includes("creator"),
        isAdmin: roles.includes("admin"),
        isAmbassador: roles.includes("ambassador"),
        isSeller: roles.includes("seller"),
        mfaEnabled,
        canUseDemoPreview,
        demoPreviewRole,
        setDemoPreviewRole,
        signOut,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
