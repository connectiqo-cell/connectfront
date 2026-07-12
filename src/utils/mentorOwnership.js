/** True when candidateId is the signed-in user (auth user or loaded profile). */
export function isSameUserId(candidateId, user, profile) {
  if (candidateId == null || candidateId === '') return false;
  const target = String(candidateId);
  return Boolean(
    (user?.id && String(user.id) === target)
    || (profile?.id && String(profile.id) === target),
  );
}
