import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/demo-creators";
import { setDemoPinnedPost } from "@/lib/demo-operations";

export async function setPinnedPostForCreator(input: {
  viewerId: string;
  creatorId: string;
  postId: string | null;
}) {
  if (DEMO_MODE && input.creatorId.startsWith("demo-")) {
    setDemoPinnedPost(input.viewerId, input.postId);
    return;
  }

  const { error } = await (supabase as any).rpc("set_pinned_post", {
    _post_id: input.postId,
  });
  if (error) throw error;
}
