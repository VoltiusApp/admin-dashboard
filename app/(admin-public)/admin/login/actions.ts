"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function loginAction(formData: FormData) {
  const email = (formData.get("email") as string).trim().toLowerCase();
  const password = formData.get("password") as string;

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";

  if (!adminEmails.includes(email)) {
    redirect("/admin/login?error=credentials");
  }
  if (!adminPassword || password !== adminPassword) {
    redirect("/admin/login?error=credentials");
  }

  const cookieStore = await cookies();
  cookieStore.set("ADMIN_SESSION", email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 8 * 60 * 60,
    path: "/",
  });

  redirect("/admin/users");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("ADMIN_SESSION");
  redirect("/admin/login");
}
