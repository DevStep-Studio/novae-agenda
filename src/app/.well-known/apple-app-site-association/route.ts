import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Apple App Site Association (AASA) para iOS Universal Links
 * Permite que links https://usereservei.com.br/agendar/{slug} abram diretamente o app Reservei no iPhone.
 */
export async function GET() {
  const aasa = {
    applinks: {
      apps: [],
      details: [
        {
          appID: "TEAMID.br.com.usereservei.app",
          paths: [
            "/agendar/*",
            "/r/*",
            "/minhas-reservas*",
            "/verify-email*",
          ],
        },
      ],
    },
    webcredentials: {
      apps: ["TEAMID.br.com.usereservei.app"],
    },
  };

  return new NextResponse(JSON.stringify(aasa, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
