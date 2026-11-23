const keyPrefix = "ppanel:guest-checkout:";
let current: { orderNo: string; token: string } | undefined;

export function saveGuestCheckout(orderNo: string, token: string) {
  current = { orderNo, token };
  try {
    sessionStorage.setItem(keyPrefix + orderNo, token);
  } catch {
    // Keep the checkout usable until navigation or reload if storage is blocked.
  }
}

export function readGuestCheckout(orderNo: string) {
  if (current?.orderNo === orderNo) return current.token;
  try {
    return sessionStorage.getItem(keyPrefix + orderNo) || undefined;
  } catch {
    return;
  }
}

export function clearGuestCheckout(orderNo: string) {
  if (current?.orderNo === orderNo) current = undefined;
  try {
    sessionStorage.removeItem(keyPrefix + orderNo);
  } catch {
    // The in-memory copy has already been cleared.
  }
}

export function isCheckoutAccessError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const failure = error as Error & {
    code?: number;
    response?: { status?: number; data?: { code?: number } };
  };
  const code = failure.response?.data?.code ?? failure.code;
  const status = failure.response?.status;
  return code === 40_005 || code === 403 || status === 401 || status === 403;
}
