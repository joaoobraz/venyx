export function hasGoalContentAccess({
  isOwner = false,
  goalReached,
  participated,
}: {
  isOwner?: boolean;
  goalReached: boolean;
  participated: boolean;
}): boolean {
  return isOwner || (goalReached && participated);
}
