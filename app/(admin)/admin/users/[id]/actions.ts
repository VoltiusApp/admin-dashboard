"use server";

import { adminFetch } from "@/app/lib/admin-api";
import { revalidatePath } from "next/cache";

export async function patchUserAction(userId: string, formData: FormData) {
  const tier = formData.get("tier") as string | null;
  const discount_pct = formData.get("discount_pct")
    ? Number(formData.get("discount_pct"))
    : undefined;
  const admin_notes = formData.get("admin_notes") as string | null;
  const trial_used = formData.has("trial_used")
    ? formData.get("trial_used") === "true"
    : undefined;

  await adminFetch(`/v1/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...(tier ? { tier } : {}),
      ...(discount_pct !== undefined ? { discount_pct } : {}),
      ...(admin_notes !== null ? { admin_notes } : {}),
      ...(trial_used !== undefined ? { trial_used } : {}),
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
