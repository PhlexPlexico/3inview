import { isIPv4 } from "net";

/** Only private/loopback/link-local IPv4 addresses, so this can never be used as an open proxy. */
export function isPrivateIPv4(ip: string): boolean {
  if (!isIPv4(ip)) return false;
  const [a, b] = ip.split(".").map(Number) as [number, number];
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
}
