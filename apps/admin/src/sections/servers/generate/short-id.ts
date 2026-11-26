/**
 * Generate a short ID for Reality
 * @returns A random hexadecimal string of length 2, 4, 6, 8, 10, 12, 14, or 16
 */
export function generateRealityShortId() {
  const lengths = [2, 4, 6, 8, 10, 12, 14, 16];
  const [lenByte] = crypto.getRandomValues(new Uint8Array(1));
  const len = lengths[(lenByte ?? 0) % lengths.length] ?? 16;
  const bytes = crypto.getRandomValues(new Uint8Array(len / 2));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}
