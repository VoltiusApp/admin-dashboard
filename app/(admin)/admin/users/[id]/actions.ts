"use server";

import { adminFetch } from "@/app/lib/admin-api";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function patchUserAction(userId: string, formData: FormData) {
  const tier = formData.get("tier") as string | null;
  const discount_pct = formData.get("discount_pct")
    ? Number(formData.get("discount_pct"))
    : undefined;
  const admin_notes = formData.get("admin_notes") as string | null;
  const trial_used = formData.has("trial_used")
    ? formData.get("trial_used") === "true"
    : undefined;
  const admin_override = formData.has("admin_override")
    ? formData.get("admin_override") === "true"
    : false;
  const seat_count = formData.get("seat_count")
    ? Number(formData.get("seat_count"))
    : undefined;

  await adminFetch(`/v1/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...(tier ? { tier } : {}),
      ...(discount_pct !== undefined ? { discount_pct } : {}),
      ...(admin_notes !== null ? { admin_notes } : {}),
      ...(trial_used !== undefined ? { trial_used } : {}),
      ...(seat_count !== undefined ? { seat_count } : {}),
      admin_override,
    }),
  });
  revalidatePath(`/admin/users/${userId}`);
}

export async function banUserAction(userId: string, formData: FormData) {
  const reason = formData.get("reason") as string;
  await adminFetch(`/v1/admin/users/${userId}/ban`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  revalidatePath(`/admin/users/${userId}`);
}

export async function unbanUserAction(userId: string) {
  await adminFetch(`/v1/admin/users/${userId}/unban`, { method: "POST" });
  revalidatePath(`/admin/users/${userId}`);
}

export async function clearTrialAction(userId: string) {
  await adminFetch(`/v1/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ clear_trial: true, trial_used: true }),
  });
  revalidatePath(`/admin/users/${userId}`);
}

export async function extendTrialAction(userId: string, days: number) {
  await adminFetch(`/v1/admin/users/${userId}/extend-trial`, {
    method: "POST",
    body: JSON.stringify({ days }),
  });
  revalidatePath(`/admin/users/${userId}`);
}

export async function setTrialAction(userId: string, days: number) {
  const trial_ends_at = new Date(Date.now() + days * 86400000).toISOString();
  await adminFetch(`/v1/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ trial_ends_at, trial_used: false }),
  });
  revalidatePath(`/admin/users/${userId}`);
}

export async function setFlagAction(
  userId: string,
  flag: string,
  enabled: boolean
) {
  await adminFetch(`/v1/admin/users/${userId}/flags/${flag}`, {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });
  revalidatePath(`/admin/users/${userId}`);
}

export type DeleteResult =
  | { ok: true }
  | { ok: false; error: string; constraint?: string; message?: string };

export async function deleteUserAction(
  userId: string,
  formData: FormData
): Promise<DeleteResult> {
  const force = formData.get("force") === "true";
  const reason = (formData.get("reason") as string | null)?.trim() || null;
  const confirmEmail = (formData.get("confirm_email") as string | null)?.trim();
  const expectedEmail = (formData.get("expected_email") as string | null)?.trim();

  if (!expectedEmail || confirmEmail !== expectedEmail) {
    return { ok: false, error: "confirm_mismatch", message: "Email confirmation did not match." };
  }
  if (force) {
    const confirmDelete = formData.get("confirm_delete") as string | null;
    if (confirmDelete !== "DELETE") {
      return {
        ok: false,
        error: "confirm_force_required",
        message: "Type DELETE to confirm permanent deletion.",
      };
    }
  }

  const qs = force ? "?force=true" : "";
  const res = await adminFetch(`/v1/admin/users/${userId}${qs}`, {
    method: "DELETE",
    body: JSON.stringify({ reason }),
  });

  if (res.status === 204) {
    if (force) {
      // User row is gone — go back to the list.
      revalidatePath("/admin/users");
      redirect("/admin/users");
    }
    revalidatePath(`/admin/users/${userId}`);
    revalidatePath("/admin/users");
    return { ok: true };
  }

  const body = await res.json().catch(() => ({}));
  return {
    ok: false,
    error: body.error ?? `http_${res.status}`,
    constraint: body.constraint,
    message: body.message ?? res.statusText,
  };
}

export async function restoreUserAction(userId: string) {
  await adminFetch(`/v1/admin/users/${userId}/restore`, { method: "POST" });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}
