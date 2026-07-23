import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv, isAuthDisabled } from "@/lib/supabase/env";

const PUBLIC_PATHS = ["/login"];

async function readSetupComplete(
  supabase: ReturnType<typeof createServerClient>,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("company_settings")
      .select("is_setup_complete")
      .eq("id", 1)
      .maybeSingle();

    if (error) return true;
    if (
      data &&
      typeof (data as { is_setup_complete?: unknown }).is_setup_complete === "boolean"
    ) {
      return (data as { is_setup_complete: boolean }).is_setup_complete;
    }
    return true;
  } catch {
    return true;
  }
}

export async function updateSession(request: NextRequest) {
  if (isAuthDisabled()) {
    return NextResponse.next({ request });
  }

  let url: string;
  let key: string;
  try {
    ({ url, key } = getSupabaseEnv());
  } catch {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  const isApiRoute = pathname.startsWith("/api/");
  const isSetupRoute = pathname === "/setup" || pathname.startsWith("/setup/");

  if (!user && !isPublic && !isApiRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && !isApiRoute) {
    const setupComplete = await readSetupComplete(supabase);

    if (user && pathname === "/login") {
      const target = request.nextUrl.clone();
      target.pathname = setupComplete ? "/" : "/setup";
      target.search = "";
      return NextResponse.redirect(target);
    }

    if (!setupComplete && !isSetupRoute && !isPublic) {
      const setupUrl = request.nextUrl.clone();
      setupUrl.pathname = "/setup";
      setupUrl.search = "";
      return NextResponse.redirect(setupUrl);
    }

    if (setupComplete && isSetupRoute) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/";
      homeUrl.search = "";
      return NextResponse.redirect(homeUrl);
    }
  }

  return supabaseResponse;
}
