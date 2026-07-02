import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ROLE_PERMISSION_DEFAULTS } from "@/modules/settings/permissions/permission-catalog";
import type { AppRole } from "@/modules/settings/types";

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function assertAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "غير مصرّح." }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_active || profile.role !== "admin") {
    return {
      error: NextResponse.json({ error: "يتطلب صلاحية مدير النظام." }, { status: 403 }),
    };
  }

  return { user };
}

export async function POST(request: Request) {
  const adminCheck = await assertAdmin();
  if ("error" in adminCheck && adminCheck.error) {
    return adminCheck.error;
  }

  const serviceClient = getServiceRoleClient();
  if (!serviceClient) {
    return NextResponse.json(
      {
        error:
          "مفتاح SUPABASE_SERVICE_ROLE_KEY غير مُعد — أنشئ المستخدمين من لوحة Supabase Auth.",
      },
      { status: 503 },
    );
  }

  const body = (await request.json()) as {
    email?: string;
    password?: string;
    full_name_ar?: string;
    full_name_en?: string;
    role?: AppRole;
  };

  if (!body.email?.trim() || !body.password || !body.full_name_ar?.trim()) {
    return NextResponse.json(
      { error: "البريد وكلمة المرور والاسم مطلوبة." },
      { status: 400 },
    );
  }

  const role: AppRole = body.role ?? "accountant";

  const { data, error } = await serviceClient.auth.admin.createUser({
    email: body.email.trim(),
    password: body.password,
    email_confirm: true,
    user_metadata: {
      full_name_ar: body.full_name_ar.trim(),
      full_name_en: body.full_name_en?.trim() || null,
    },
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message || "فشل إنشاء المستخدم." },
      { status: 400 },
    );
  }

  const { error: profileError } = await serviceClient
    .from("profiles")
    .update({
      full_name_ar: body.full_name_ar.trim(),
      full_name_en: body.full_name_en?.trim() || null,
      role,
      is_active: true,
    })
    .eq("id", data.user.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const defaultPermissions = ROLE_PERMISSION_DEFAULTS[role];
  if (defaultPermissions.length > 0) {
    await serviceClient.from("user_permissions").delete().eq("user_id", data.user.id);
    const { error: permissionsError } = await serviceClient
      .from("user_permissions")
      .insert(
        defaultPermissions.map((permission_key) => ({
          user_id: data.user.id,
          permission_key,
        })),
      );
    if (permissionsError) {
      return NextResponse.json({ error: permissionsError.message }, { status: 400 });
    }
  }

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  });
}
