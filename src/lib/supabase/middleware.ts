import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { cookieDeSessao } from "@/lib/supabase/cookies";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Autenticação ainda não configurada (Supabase entra na Fase 2) - não bloquear o app.
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, cookieDeSessao(options))
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/registro");
  const isPersonalRoute = pathname.startsWith("/personal");
  const isAlunoRoute = pathname.startsWith("/aluno");

  if (!user && (isPersonalRoute || isAlunoRoute)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = roleHome(user.app_metadata?.role);
    return NextResponse.redirect(url);
  }

  // Controle de acesso por role nas páginas: um Aluno não acessa /personal/**
  // e um Personal não acessa /aluno/** (as rotas de API aplicam a mesma
  // regra de forma independente, via requirePersonal/requireAluno).
  if (user) {
    const role = user.app_metadata?.role;
    if (isPersonalRoute && role !== "PERSONAL") {
      return NextResponse.redirect(new URL(roleHome(role), request.url));
    }
    if (isAlunoRoute && role !== "ALUNO") {
      return NextResponse.redirect(new URL(roleHome(role), request.url));
    }
  }

  return supabaseResponse;
}

function roleHome(role: unknown) {
  if (role === "PERSONAL") return "/personal";
  if (role === "ALUNO") return "/aluno";
  return "/";
}
