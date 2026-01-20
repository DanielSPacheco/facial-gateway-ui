import { gatewayBaseUrl } from "@/lib/gateway";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get("deviceId");
  const channel = searchParams.get("channel") || "1";
  const cacheBust = searchParams.get("t") || Date.now().toString();

  if (!deviceId) {
    return new Response("Missing deviceId", { status: 400 });
  }

  const targetUrl = new URL(
    `/facial/${encodeURIComponent(deviceId)}/snapshot`,
    gatewayBaseUrl
  );
  targetUrl.searchParams.set("channel", channel);
  targetUrl.searchParams.set("t", cacheBust);

  try {
    const upstream = await fetch(targetUrl.toString(), {
      cache: "no-store",
    });

    if (!upstream.ok) {
      return new Response("Snapshot unavailable", { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const buffer = await upstream.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return new Response("Snapshot error", { status: 502 });
  }
}
