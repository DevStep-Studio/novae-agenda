import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Canonical customer route redirects
  if (pathname === "/cliente" || pathname === "/meus-agendamentos") {
    const url = request.nextUrl.clone();
    url.pathname = "/minhas-reservas";
    return NextResponse.redirect(url, 301);
  }

  // Canonical management route redirects
  if (pathname === "/dashboard") {
    const url = request.nextUrl.clone();
    url.pathname = "/gestao";
    return NextResponse.redirect(url, 301);
  }

  if (pathname === "/agenda") {
    const url = request.nextUrl.clone();
    url.pathname = "/gestao/agenda";
    return NextResponse.redirect(url, 301);
  }

  if (pathname === "/clientes") {
    const url = request.nextUrl.clone();
    url.pathname = "/gestao/clientes";
    return NextResponse.redirect(url, 301);
  }

  if (pathname === "/servicos") {
    const url = request.nextUrl.clone();
    url.pathname = "/gestao/servicos";
    return NextResponse.redirect(url, 301);
  }

  if (pathname === "/equipe") {
    const url = request.nextUrl.clone();
    url.pathname = "/gestao/equipe";
    return NextResponse.redirect(url, 301);
  }

  if (pathname === "/financeiro") {
    const url = request.nextUrl.clone();
    url.pathname = "/gestao/financeiro";
    return NextResponse.redirect(url, 301);
  }

  if (pathname === "/relatorios") {
    const url = request.nextUrl.clone();
    url.pathname = "/gestao/relatorios";
    return NextResponse.redirect(url, 301);
  }

  if (pathname === "/assinatura" || pathname === "/minha-assinatura") {
    const url = request.nextUrl.clone();
    url.pathname = "/gestao/assinatura";
    return NextResponse.redirect(url, 301);
  }

  if (pathname === "/configuracoes") {
    const url = request.nextUrl.clone();
    url.pathname = "/gestao/configuracoes";
    return NextResponse.redirect(url, 301);
  }

  if (pathname === "/link-agendamento") {
    const url = request.nextUrl.clone();
    url.pathname = "/gestao/link-agendamento";
    return NextResponse.redirect(url, 301);
  }

  // Redirecionamento automático de rotas restritas para /login quando não autenticado
  const hasSessionCookie = Boolean(request.cookies.get("agenda_session")?.value);
  if (
    !hasSessionCookie &&
    (pathname.startsWith("/gestao") ||
      pathname.startsWith("/notificacoes") ||
      pathname.startsWith("/profissional"))
  ) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("returnTo", pathname + (search || ""));
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/cliente",
    "/meus-agendamentos",
    "/dashboard",
    "/agenda",
    "/clientes",
    "/servicos",
    "/equipe",
    "/financeiro",
    "/relatorios",
    "/assinatura",
    "/minha-assinatura",
    "/configuracoes",
    "/link-agendamento",
    "/gestao/:path*",
    "/gestao",
    "/notificacoes",
    "/profissional/:path*",
    "/profissional",
  ],
};
