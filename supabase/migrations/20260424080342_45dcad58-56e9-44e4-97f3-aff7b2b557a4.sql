
-- Helper function to check post access without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.can_view_post(_post_id uuid, _viewer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = _post_id
      AND (
        p.visibility = 'public'
        OR p.creator_id = _viewer_id
        OR (p.visibility = 'subscribers' AND _viewer_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.subscriptions s
              WHERE s.creator_id = p.creator_id
                AND s.subscriber_id = _viewer_id
                AND s.status = 'active'
            ))
        OR (p.visibility = 'ppv' AND _viewer_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.ppv_unlocks u
              WHERE u.post_id = p.id AND u.user_id = _viewer_id
            ))
        OR (p.visibility = 'goal' AND (
              EXISTS (SELECT 1 FROM public.post_goals g WHERE g.post_id = p.id AND g.is_unlocked)
              OR (_viewer_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.post_goal_contributions c
                    WHERE c.post_id = p.id AND c.user_id = _viewer_id
                  ))
            ))
      )
  );
$$;

-- Replace the recursive SELECT policy on posts
DROP POLICY IF EXISTS "Posts visíveis conforme acesso" ON public.posts;
CREATE POLICY "Posts visíveis conforme acesso"
ON public.posts
FOR SELECT
USING (public.can_view_post(id, auth.uid()));
