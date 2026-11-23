export type NodeAddressKind = "ipv4" | "ipv6" | "hostname";

function isIPv6(address: string) {
  const host =
    address.startsWith("[") && address.endsWith("]")
      ? address.slice(1, -1)
      : address;
  if (!(host.includes(":") && /^[\da-f:.]+$/i.test(host))) return false;
  try {
    return Boolean(new URL(`http://[${host}]/`).hostname);
  } catch {
    return false;
  }
}

export function nodeAddressKind(raw: string): NodeAddressKind | undefined {
  const address = raw.trim();
  if (!address) return;
  if (isIPv6(address)) return "ipv6";
  if (/^[\d.]+$/.test(address)) {
    const octets = address.split(".");
    if (
      octets.length === 4 &&
      octets.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
    ) {
      return "ipv4";
    }
    return;
  }
  if (/[\s:/?#@[\]\\]/.test(address)) return;
  try {
    const host = new URL(`http://${address}/`).hostname.replace(/\.$/, "");
    return host &&
      /[a-z]/i.test(host) &&
      host
        .split(".")
        .every((label) => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label))
      ? "hostname"
      : undefined;
  } catch {
    return;
  }
}

export function formatNodeEndpoint(address: string, port: number) {
  const host = address.trim();
  if (!host) return;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return host;
  if (isIPv6(host) && !host.startsWith("[")) return `[${host}]:${port}`;
  return `${host}:${port}`;
}
