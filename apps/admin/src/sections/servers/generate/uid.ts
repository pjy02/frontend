const DEFAULT_PASSWORD_CHARSET = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Generate a cryptographically random password
 * @param length Length of the password
 * @param charset Character set to use (defaults to lowercase alphanumeric)
 * @returns Randomly generated password
 */
export function generatePassword(length = 16, charset?: string) {
  if (length <= 0) return "";
  const chars =
    charset && charset.length > 0 ? charset : DEFAULT_PASSWORD_CHARSET;
  const charsetLength = chars.length;
  if (charsetLength === 1) {
    return chars.repeat(length);
  }

  const range = 0x1_00_00_00_00;
  const maxUnbiased = Math.floor(range / charsetLength) * charsetLength;
  let out = "";
  while (out.length < length) {
    const words = crypto.getRandomValues(
      new Uint32Array(Math.max(length - out.length, 16))
    );
    for (const word of words) {
      if (word < maxUnbiased) {
        out += chars[word % charsetLength];
        if (out.length === length) break;
      }
    }
  }
  return out;
}
