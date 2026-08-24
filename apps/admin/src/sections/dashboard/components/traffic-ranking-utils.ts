type AuthMethod = {
  auth_identifier: string;
  auth_type: string;
};

export function getTrafficRankWidth(total: number, leaderTotal: number) {
  if (total <= 0 || leaderTotal <= 0) {
    return 0;
  }

  return Math.min((total / leaderTotal) * 100, 100);
}

export function getUserEmail(user?: { auth_methods?: AuthMethod[] } | null) {
  const identifier = user?.auth_methods?.find(
    (method) => method.auth_type.toLowerCase() === "email"
  )?.auth_identifier;

  return identifier?.trim() || undefined;
}
