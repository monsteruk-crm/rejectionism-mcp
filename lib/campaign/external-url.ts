/**
 * Strict external-URL validator for EXTERNAL_URL asset representations
 * (upgrade plan section 8, "External URLs and base origin").
 *
 * Rules: WHATWG URL parse; length <= 2048; protocol exactly http: or https:;
 * nonempty host; reject username/password, control characters, localhost,
 * `.localhost`, `.local`, and literal loopback/private/link-local IP
 * destinations. Never resolves DNS and never issues requests — this checks
 * obvious local/credential-bearing links, not SSRF defense for a fetcher.
 *
 * This module is intentionally pure (no "server-only") so browser-safe
 * validator modules can reuse it in later phases.
 */

const MAX_EXTERNAL_URL_LENGTH = 2048;

// C0 control characters and DEL.
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/;

function isPrivateIpv4(octets: number[]): boolean {
  const [a, b] = octets;
  return (
    a === 0 || // 0.0.0.0/8 ("this network"; effectively local)
    a === 10 || // 10.0.0.0/8 private
    a === 127 || // loopback
    (a === 169 && b === 254) || // link-local
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 private
    (a === 192 && b === 168) // 192.168.0.0/16 private
  );
}

function isPrivateIpv4Literal(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4) {
    return false;
  }

  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return false;
    }
    const value = Number(part);
    if (value > 255) {
      return false;
    }
    octets.push(value);
  }

  return isPrivateIpv4(octets);
}

function isPrivateIpv6Literal(hostname: string): boolean {
  // WHATWG URL keeps brackets in `hostname` for IPv6 literals.
  const address = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1).toLowerCase()
    : hostname.toLowerCase();

  if (address === "::1" || address === "::") {
    return true; // loopback / unspecified
  }

  // IPv4-mapped form. The WHATWG serializer emits hex groups (e.g. ::ffff:7f00:1),
  // but accept the dotted form as well for defense in depth.
  const mapped = address.match(/^::ffff:(.+)$/);
  if (mapped) {
    const tail = mapped[1];
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(tail)) {
      return isPrivateIpv4Literal(tail);
    }

    const groups = tail.split(":");
    if (groups.length === 2 && groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) {
      const high = parseInt(groups[0], 16);
      const low = parseInt(groups[1], 16);
      return isPrivateIpv4([(high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff]);
    }

    return false;
  }

  const firstGroup = address.split(":")[0] ?? "";
  if (/^fe[89ab]/.test(firstGroup)) {
    return true; // fe80::/10 link-local
  }

  if (/^f[cd]/.test(firstGroup)) {
    return true; // fc00::/7 unique local
  }

  return false;
}

export function isExternalHttpUrl(value: unknown): boolean {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_EXTERNAL_URL_LENGTH) {
    return false;
  }

  // WHATWG URL parsing silently strips tab/newline from the input, so control
  // characters must be rejected on the raw string before parsing.
  if (CONTROL_CHAR_PATTERN.test(value)) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  if (parsed.username !== "" || parsed.password !== "") {
    return false;
  }

  const hostname = parsed.hostname;
  if (hostname.length === 0) {
    return false;
  }

  const isIpv4Literal = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  const isIpv6Literal = hostname.startsWith("[");
  if (isIpv4Literal) {
    return !isPrivateIpv4Literal(hostname);
  }
  if (isIpv6Literal) {
    return !isPrivateIpv6Literal(hostname);
  }

  const lowerHostname = hostname.toLowerCase();
  if (
    lowerHostname === "localhost" ||
    lowerHostname.endsWith(".localhost") ||
    lowerHostname.endsWith(".local")
  ) {
    return false;
  }

  return true;
}
