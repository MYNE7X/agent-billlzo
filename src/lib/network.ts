/** Fetch the caller's current public IPv4 address via a free CDN endpoint. */
export async function getPublicIP(): Promise<string> {
  // Try multiple fallbacks in case one is down
  const endpoints = [
    "https://api.ipify.org?format=json",
    "https://api4.my-ip.io/v2/ip.json",
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const json = await res.json() as Record<string, string>;
      const ip = json.ip ?? json.IP ?? json.ipAddress;
      if (ip) return ip;
    } catch {
      // try next
    }
  }
  throw new Error("Could not detect your public IP address.");
}
