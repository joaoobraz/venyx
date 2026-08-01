import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { StoryViewer, type StoryGroup } from "@/components/StoryViewer";
import { getStoryMediaUrls } from "@/_server/media.functions";
import { DEMO_MODE, getDemoAsset } from "@/lib/demo-creators";
import { useI18n } from "@/lib/i18n";
import { moderateBeforeUpload } from "@/lib/moderation";

interface RawStory {
  id: string;
  creator_id: string;
  media_path: string;
  mime_type: string;
  visibility: "public" | "subscribers";
  expires_at: string;
  created_at: string;
}

export function StoriesBar() {
  const { user, isCreator } = useAuth();
  const { tr } = useI18n();
  const storyMediaFn = useServerFn(getStoryMediaUrls);
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const { data: stories } = await supabase
      .from("stories")
      .select("*")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });
    const list = (stories ?? []) as RawStory[];
    if (list.length === 0) {
      setGroups([]);
      return;
    }
    let urlsByStoryId: Record<string, { url: string; mime_type: string }> = {};
    try {
      const signed = await storyMediaFn({
        data: { storyIds: list.map((story) => story.id) },
      });
      urlsByStoryId = signed.urlsByStoryId;
    } catch {
      setGroups([]);
      return;
    }
    const ids = Array.from(new Set(list.map((s) => s.creator_id)));
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .in("user_id", ids);
    const profById = new Map(
      (
        (profs ?? []) as {
          user_id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
        }[]
      ).map((p) => [p.user_id, p]),
    );
    const grouped = new Map<string, StoryGroup>();
    list.forEach((s) => {
      const signed = urlsByStoryId[s.id];
      if (!signed) return;
      const p = profById.get(s.creator_id);
      if (!p) return;
      const demo = DEMO_MODE ? getDemoAsset(p.username) : null;
      const g = grouped.get(s.creator_id) ?? {
        creator_id: s.creator_id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: demo?.avatar_url ?? p.avatar_url,
        stories: [],
      };
      g.stories.push({
        id: s.id,
        url: demo?.cover_url ?? signed.url,
        mime: demo ? "image/webp" : signed.mime_type,
        created_at: s.created_at,
      });
      grouped.set(s.creator_id, g);
    });
    setGroups(Array.from(grouped.values()));
  }, [storyMediaFn]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const moderation = await moderateBeforeUpload(f, "story", user.id);
      if (!moderation.allowed) {
        toast.error(
          moderation.reason ||
            tr("Não foi possível aprovar esta mídia.", "This media could not be approved."),
        );
        return;
      }
      const ext = f.name.split(".").pop() || "bin";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: ue } = await supabase.storage
        .from("stories")
        .upload(path, f, { contentType: f.type });
      if (ue) throw ue;
      const { error: ie } = await supabase.from("stories").insert({
        creator_id: user.id,
        media_path: path,
        mime_type: f.type,
        visibility: "public",
      });
      if (ie) throw ie;
      toast.success(tr("Story publicado!", "Story published!"));
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("Erro", "Error"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  if (!isCreator && groups.length === 0) return null;

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {isCreator && (
          <label className="flex shrink-0 cursor-pointer flex-col items-center gap-1.5">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-primary/50 bg-card hover:border-primary">
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <Plus className="h-6 w-6 text-primary" />
              )}
            </div>
            <span className="text-[10px] font-medium text-muted-foreground">
              {tr("Seu story", "Your story")}
            </span>
            <input type="file" accept="image/*,video/*" className="hidden" onChange={upload} />
          </label>
        )}
        {groups.map((g, i) => (
          <button
            key={g.creator_id}
            onClick={() => setOpenIdx(i)}
            className="flex shrink-0 flex-col items-center gap-1.5"
          >
            <div className="rounded-full bg-gradient-primary p-[2px] shadow-glow">
              <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-background bg-muted">
                {g.avatar_url ? (
                  <img src={g.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                    {g.username[0]?.toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <span className="max-w-[64px] truncate text-[10px] font-medium text-foreground">
              {g.display_name || g.username}
            </span>
          </button>
        ))}
      </div>
      {openIdx !== null && groups[openIdx] && (
        <StoryViewer groups={groups} startIdx={openIdx} onClose={() => setOpenIdx(null)} />
      )}
    </>
  );
}
