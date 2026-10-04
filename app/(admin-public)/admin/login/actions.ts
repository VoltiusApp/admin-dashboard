"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, isAllowedEmail, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/app/lib/session";

export async function loginAction(formData: FormData) {
  const email = (formData.get("email") as string).trim().toLowerCase();
  const password = formData.get("password") as string;
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";

  if (!isAllowedEmail(email)) {
    redirect("/admin/login?error=credentials");
  }
  if (!adminPassword || password !== adminPassword) {
    redirect("/admin/login?error=credentials");
  }

  const session = await createSession(email);
  if (!session) {
    redirect("/admin/login?error=config");
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });

  redirect("/admin/users");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/admin/login");
}
