import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export interface StoryItem {
  id: string;
  url: string;
  mime: string;
  created_at: string;
}

export interface StoryGroup {
  creator_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  stories: StoryItem[];
}

const DURATION = 5000;

export function StoryViewer({
  groups,
  startIdx,
  onClose,
}: {
  groups: StoryGroup[];
  startIdx: number;
  onClose: () => void;
}) {
  const [gIdx, setGIdx] = useState(startIdx);
  const [sIdx, setSIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  const group = groups[gIdx];
  const story = group?.stories[sIdx];

  useEffect(() => {
    setProgress(0);
    if (!story || story.mime.startsWith("video/")) return;
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / DURATION) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(id);
        next();
      }
    }, 50);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gIdx, sIdx]);

  const next = () => {
    if (sIdx + 1 < group.stories.length) setSIdx(sIdx + 1);
    else if (gIdx + 1 < groups.length) {
      setGIdx(gIdx + 1);
      setSIdx(0);
    } else onClose();
  };
  const prev = () => {
    if (sIdx > 0) setSIdx(sIdx - 1);
    else if (gIdx > 0) {
      setGIdx(gIdx - 1);
      setSIdx(0);
    }
  };

  if (!group || !story) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95">
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      <button
        onClick={prev}
        className="absolute left-4 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 md:block"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        onClick={next}
        className="absolute right-4 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 md:block"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      <div className="relative h-full max-h-[100dvh] w-full max-w-md">
        {/* Progress bars */}
        <div className="absolute left-0 right-0 top-0 z-10 flex gap-1 p-2">
          {group.stories.map((_, i) => (
            <div key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full bg-white transition-all"
                style={{
                  width: i < sIdx ? "100%" : i === sIdx ? `${progress}%` : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute left-0 right-0 top-4 z-10 flex items-center gap-2 px-4 pt-2">
          <div className="h-9 w-9 overflow-hidden rounded-full border border-white/30 bg-muted">
            {group.avatar_url ? (
              <img src={group.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white">
                {group.username[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{group.display_name || group.username}</div>
            <div className="text-[10px] text-white/60">@{group.username}</div>
          </div>
        </div>

        {/* Media — clickable zones for prev/next on mobile */}
        <div className="relative h-full">
          {story.mime.startsWith("video/") ? (
            <video
              key={story.id}
              src={story.url}
              autoPlay
              playsInline
              onEnded={next}
              className="h-full w-full object-contain"
            />
          ) : (
            <img src={story.url} alt="" className="h-full w-full object-contain" />
          )}
          <button onClick={prev} className="absolute left-0 top-0 h-full w-1/3" aria-label="prev" />
          <button onClick={next} className="absolute right-0 top-0 h-full w-1/3" aria-label="next" />
        </div>
      </div>
    </div>
  );
}
