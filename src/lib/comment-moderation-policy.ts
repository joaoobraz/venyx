export type CommentModerationDecision =
  | { accepted: false; status: "blocked_user" }
  | { accepted: false; status: "blocked_keyword"; blockedKeyword: string }
  | { accepted: true; status: "pending" | "published" };

export function evaluateCommentModerationPolicy(input: {
  manualApproval: boolean;
  blockedKeywords: string[];
  blockedUserIds: string[];
  userId: string;
  body: string;
}): CommentModerationDecision {
  if (input.blockedUserIds.includes(input.userId)) {
    return { accepted: false, status: "blocked_user" };
  }

  const normalizedBody = input.body.toLocaleLowerCase("pt-BR");
  const blockedKeyword = input.blockedKeywords.find((keyword) =>
    normalizedBody.includes(keyword.trim().toLocaleLowerCase("pt-BR")),
  );
  if (blockedKeyword) {
    return { accepted: false, status: "blocked_keyword", blockedKeyword };
  }

  return {
    accepted: true,
    status: input.manualApproval ? "pending" : "published",
  };
}
