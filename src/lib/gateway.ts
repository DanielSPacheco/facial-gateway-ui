export const gatewayBaseUrl = (
  process.env.NEXT_PUBLIC_GATEWAY_URL || "http://127.0.0.1:4000"
).replace(/\/+$/, "");

export function buildGatewayUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${gatewayBaseUrl}${normalized}`;
}
