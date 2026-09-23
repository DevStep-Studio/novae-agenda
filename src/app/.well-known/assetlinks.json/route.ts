import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Android Digital Asset Links (assetlinks.json)
 * Permite que links https://usereservei.com.br/agendar/{slug} abram diretamente o app no Android via App Links verificados.
 */
export async function GET() {
  const assetLinks = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "br.com.usereservei.app",
        sha256_cert_fingerprints: [
          // SHA-256 fingerprint do keystore de release/Play Store
          "FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C",
        ],
      },
    },
  ];

  return new NextResponse(JSON.stringify(assetLinks, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
