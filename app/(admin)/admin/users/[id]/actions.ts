"use server";

import { adminFetch } from "@/app/lib/admin-api";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Throws so a rejected change reaches the error boundary instead of looking saved.
async function mutateUser(userId: string, path: string, init: RequestInit) {
  const res = await adminFetch(`/v1/admin/users/${userId}${path}`, init);
  if (!res.ok) throw new Error(`${init.method} /v1/admin/users/${userId}${path} failed: ${res.status}`);
  revalidatePath(`/admin/users/${userId}`);
}

const patchUser = (userId: string, body: Record<string, unknown>) =>
  mutateUser(userId, "", { method: "PATCH", body: JSON.stringify(body) });

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
  const unlimited_seats = formData.get("unlimited_seats") === "true";
  const seat_count =
    !unlimited_seats && formData.get("seat_count")
      ? Number(formData.get("seat_count"))
      : undefined;

  // Unchecked boxes are absent from FormData, so the marker says the toggles were rendered.
  const offers = formData.has("trial_offers_present");
  const pro_trial_available = offers ? formData.has("pro_trial_available") : undefined;
  const teams_trial_available = offers ? formData.has("teams_trial_available") : undefined;

  await patchUser(userId, {
    ...(tier ? { tier } : {}),
    ...(discount_pct !== undefined ? { discount_pct } : {}),
    ...(admin_notes !== null ? { admin_notes } : {}),
    ...(trial_used !== undefined ? { trial_used } : {}),
    ...(seat_count !== undefined ? { seat_count } : {}),
    ...(unlimited_seats ? { unlimited_seats } : {}),
    ...(pro_trial_available !== undefined ? { pro_trial_available } : {}),
    ...(teams_trial_available !== undefined ? { teams_trial_available } : {}),
    admin_override,
  });
}

export async function setEmailVerifiedAction(userId: string, verified: boolean) {
  await patchUser(userId, { email_verified: verified });
}

export async function banUserAction(userId: string, formData: FormData) {
  const reason = formData.get("reason") as string;
  await mutateUser(userId, "/ban", { method: "POST", body: JSON.stringify({ reason }) });
}

export async function unbanUserAction(userId: string) {
  await mutateUser(userId, "/unban", { method: "POST" });
}

export async function clearTrialAction(userId: string) {
  await patchUser(userId, { clear_trial: true, trial_used: true });
}

export async function extendTrialAction(userId: string, days: number) {
  await mutateUser(userId, "/extend-trial", { method: "POST", body: JSON.stringify({ days }) });
}

export async function setTrialAction(userId: string, days: number) {
  const trial_ends_at = new Date(Date.now() + days * 86400000).toISOString();
  await patchUser(userId, { trial_ends_at, trial_used: false });
}

export async function setFlagAction(
  userId: string,
  flag: string,
  enabled: boolean
) {
  await mutateUser(userId, `/flags/${flag}`, { method: "PUT", body: JSON.stringify({ enabled }) });
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
  await mutateUser(userId, "/restore", { method: "POST" });
  revalidatePath("/admin/users");
}

const HANDLE_ERRORS: Record<number, string> = {
  404: "User not found.",
  409: "That handle is taken or was used before.",
  422: "Handles are 3–30 lowercase letters, digits, - or _, and some names are reserved.",
};

export async function setHandleAction(
  userId: string,
  _prev: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const handle = String(formData.get("handle") ?? "").trim();
  let res: Response;
  try {
    res = await adminFetch(`/v1/admin/users/${userId}/handle`, {
      method: "PUT",
      body: JSON.stringify({ handle }),
    });
  } catch {
    return { error: "Server unreachable." };
  }
  if (!res.ok) return { error: HANDLE_ERRORS[res.status] ?? `Failed (${res.status}).` };
  revalidatePath(`/admin/users/${userId}`);
  return { error: null };
}

export type DeriveResult = { applied: number } | { error: string } | null;

export async function deriveHandlesAction(_prev?: DeriveResult): Promise<DeriveResult> {
  try {
    const res = await adminFetch(`/v1/admin/handles/derive`, {
      method: "POST",
      body: JSON.stringify({ dry_run: false }),
    });
    if (res.status === 409) return { error: "HANDLES_FROM_EMAIL is off on the server." };
    if (!res.ok) return { error: `Failed (${res.status}).` };
    const rows: { reason: string }[] = await res.json();
    revalidatePath(`/admin/handles`);
    return { applied: rows.filter((r) => r.reason === "ok").length };
  } catch {
    return { error: "Server unreachable." };
  }
}
