import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { DEMO_MODE } from "@/lib/demo-creators";

type NotificationMuteTarget = "post" | "thread";

function demoKey(userId: string, targetType: NotificationMuteTarget, targetId: string) {
  return `venyx:demo:notification-mute:${userId}:${targetType}:${targetId}`;
}

export function NotificationMuteButton({
  targetType,
  targetId,
  compact = false,
}: {
  targetType: NotificationMuteTarget;
  targetId: string;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const { tr } = useI18n();
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from("notification_mutes")
        .select("id")
        .eq("user_id", user.id)
        .eq("target_type", targetType)
        .eq("target_id", targetId)
        .maybeSingle();
      if (cancelled) return;
      if (!error) {
        setMuted(Boolean(data));
      } else if (DEMO_MODE) {
        setMuted(localStorage.getItem(demoKey(user.id, targetType, targetId)) === "1");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [targetId, targetType, user]);

  const toggle = async () => {
    if (!user || busy) return;
    const next = !muted;
    setBusy(true);
    setMuted(next);
    const query = next
      ? supabase.from("notification_mutes").insert({
          user_id: user.id,
          target_type: targetType,
          target_id: targetId,
        })
      : supabase
          .from("notification_mutes")
          .delete()
          .eq("user_id", user.id)
          .eq("target_type", targetType)
          .eq("target_id", targetId);
    const { error } = await query;

    if (error && !DEMO_MODE) {
      setMuted(!next);
      toast.error(tr("Não foi possível alterar as notificações.", "Could not update notifications."));
    } else {
      if (DEMO_MODE) {
        if (next) localStorage.setItem(demoKey(user.id, targetType, targetId), "1");
        else localStorage.removeItem(demoKey(user.id, targetType, targetId));
      }
      toast.success(
        next
          ? tr("Notificações silenciadas.", "Notifications muted.")
          : tr("Notificações ativadas.", "Notifications enabled."),
      );
    }
    setBusy(false);
  };

  const label = muted
    ? tr("Ativar notificações", "Enable notifications")
    : tr("Silenciar notificações", "Mute notifications");

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-primary disabled:opacity-50 ${
        compact ? "h-8 w-8" : "h-9 w-9"
      }`}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : muted ? (
        <BellOff className="h-4 w-4" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
    </button>
  );
}
