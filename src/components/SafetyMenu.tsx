import { useEffect, useState } from "react";
import { Flag, MoreHorizontal, UserCheck, UserX, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { DEMO_MODE } from "@/lib/demo-creators";
import { recordDemoReport } from "@/lib/demo-operations";

type SafetyTargetType = "post" | "profile" | "message" | "conversation" | "comment";
type ReportReason = "spam" | "harassment" | "impersonation" | "underage" | "non_consensual" | "illegal" | "other";

interface SafetyMenuProps {
  targetType: SafetyTargetType;
  targetId: string;
  targetUserId: string;
  targetLabel?: string;
  onBlocked?: () => void;
}

export function SafetyMenu({
  targetType,
  targetId,
  targetUserId,
  targetLabel,
  onBlocked,
}: SafetyMenuProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [details, setDetails] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || user.id === targetUserId) return;
    if (DEMO_MODE) {
      setBlocked(localStorage.getItem(`venyx:demo:block:${user.id}:${targetUserId}`) === "1");
      setMuted(localStorage.getItem(`venyx:demo:mute:${user.id}:${targetUserId}`) === "1");
      return;
    }
    Promise.all([
      supabase
        .from("user_blocks")
        .select("blocked_id")
        .eq("blocker_id", user.id)
        .eq("blocked_id", targetUserId)
        .maybeSingle(),
      supabase
        .from("user_mutes")
        .select("muted_user_id")
        .eq("user_id", user.id)
        .eq("muted_user_id", targetUserId)
        .maybeSingle(),
    ]).then(([blockResult, muteResult]) => {
      setBlocked(Boolean(blockResult.data));
      setMuted(Boolean(muteResult.data));
    });
  }, [targetUserId, user]);

  if (!user || user.id === targetUserId) return null;

  const toggleBlock = async () => {
    setBusy(true);
    if (DEMO_MODE) {
      const key = `venyx:demo:block:${user.id}:${targetUserId}`;
      if (blocked) localStorage.removeItem(key);
      else localStorage.setItem(key, "1");
      setBusy(false);
      setBlocked(!blocked);
      toast.success(blocked ? t("safety.unblocked") : t("safety.blocked"));
      if (!blocked) onBlocked?.();
      return;
    }
    const result = blocked
      ? await supabase
          .from("user_blocks")
          .delete()
          .eq("blocker_id", user.id)
          .eq("blocked_id", targetUserId)
      : await supabase.from("user_blocks").insert({
          blocker_id: user.id,
          blocked_id: targetUserId,
        });
    setBusy(false);
    if (result.error) {
      toast.error(t("safety.error"));
      return;
    }
    setBlocked(!blocked);
    toast.success(blocked ? t("safety.unblocked") : t("safety.blocked"));
    if (!blocked) onBlocked?.();
  };

  const toggleMute = async () => {
    setBusy(true);
    if (DEMO_MODE) {
      const key = `venyx:demo:mute:${user.id}:${targetUserId}`;
      if (muted) localStorage.removeItem(key);
      else localStorage.setItem(key, "1");
      setBusy(false);
      setMuted(!muted);
      toast.success(muted ? t("safety.unmuted") : t("safety.muted"));
      return;
    }
    const result = muted
      ? await supabase
          .from("user_mutes")
          .delete()
          .eq("user_id", user.id)
          .eq("muted_user_id", targetUserId)
      : await supabase.from("user_mutes").insert({
          user_id: user.id,
          muted_user_id: targetUserId,
        });
    setBusy(false);
    if (result.error) {
      toast.error(t("safety.error"));
      return;
    }
    setMuted(!muted);
    toast.success(muted ? t("safety.unmuted") : t("safety.muted"));
  };

  const submitReport = async () => {
    setBusy(true);
    if (DEMO_MODE) {
      recordDemoReport({
        userId: user.id,
        targetType,
        targetId,
        targetUserId,
        targetLabel,
        reason,
        details,
      });
      setBusy(false);
      setReportOpen(false);
      setDetails("");
      toast.success(t("safety.reported"));
      return;
    }
    const { error } = await supabase.from("content_reports").insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reported_user_id: targetUserId,
      reason,
      details: details.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error(t("safety.error"));
      return;
    }
    setReportOpen(false);
    setDetails("");
    toast.success(t("safety.reported"));
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("safety.actions")}>
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setReportOpen(true)}>
            <Flag className="mr-2 h-4 w-4" />
            {t("safety.report")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={toggleMute} disabled={busy}>
            {muted ? <Volume2 className="mr-2 h-4 w-4" /> : <VolumeX className="mr-2 h-4 w-4" />}
            {muted ? t("safety.unmute") : t("safety.mute")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={toggleBlock} disabled={busy} className="text-destructive">
            {blocked ? <UserCheck className="mr-2 h-4 w-4" /> : <UserX className="mr-2 h-4 w-4" />}
            {blocked ? t("safety.unblock") : t("safety.block")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>{t("safety.reportTitle")}</DialogTitle>
            <DialogDescription>
              {targetLabel ? `${t("safety.reportAbout")} ${targetLabel}` : t("safety.reportDescription")}
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-2 text-sm">
            <span className="font-medium">{t("safety.reason")}</span>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value as ReportReason)}
              className="h-10 w-full rounded-md border border-input bg-background px-3"
            >
              <option value="spam">{t("safety.reason.spam")}</option>
              <option value="harassment">{t("safety.reason.harassment")}</option>
              <option value="impersonation">{t("safety.reason.impersonation")}</option>
              <option value="underage">{t("safety.reason.underage")}</option>
              <option value="non_consensual">{t("safety.reason.nonConsensual")}</option>
              <option value="illegal">{t("safety.reason.illegal")}</option>
              <option value="other">{t("safety.reason.other")}</option>
            </select>
          </label>
          <Textarea
            value={details}
            maxLength={2000}
            onChange={(event) => setDetails(event.target.value)}
            placeholder={t("safety.details")}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={submitReport} disabled={busy}>
              {t("safety.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
