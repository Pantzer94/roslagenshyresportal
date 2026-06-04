import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin-only: change a tenant's LOGIN e-post (via Supabase Auth Admin API).
 * Also updates tenants.email via the auth trigger (sync_tenant_email_from_auth).
 */
export const adminUpdateTenantLoginEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      tenant_id: z.string().uuid(),
      new_email: z.string().email().max(255),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Require admin
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Endast administratör får ändra login-e-post.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Look up tenant + linked auth user
    const { data: tenant, error: tErr } = await supabaseAdmin
      .from("tenants")
      .select("id, user_id, email")
      .eq("id", data.tenant_id)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!tenant) throw new Error("Hyresgäst saknas.");

    if (tenant.user_id) {
      // Update the auth user — trigger will sync tenants.email
      const { error: aErr } = await supabaseAdmin.auth.admin.updateUserById(
        tenant.user_id,
        { email: data.new_email, email_confirm: true },
      );
      if (aErr) throw new Error(aErr.message);
    } else {
      // Not registered yet — just update tenants.email so the next signup matches
      const { error: uErr } = await supabaseAdmin
        .from("tenants")
        .update({ email: data.new_email })
        .eq("id", tenant.id);
      if (uErr) throw new Error(uErr.message);
    }

    return { ok: true };
  });
