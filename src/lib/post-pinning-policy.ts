export function applySinglePinnedPost<T extends { id: string; is_pinned?: boolean }>(
  posts: T[],
  postId: string | null,
) {
  return posts.map((post) => ({ ...post, is_pinned: post.id === postId }));
}
