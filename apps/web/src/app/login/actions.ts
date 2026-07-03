"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

export async function loginAction(formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const authMode = process.env.AUTH_MODE ?? "local";

  try {
    await signIn(authMode === "ldap" ? "ldap" : "local", {
      username,
      password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError && error.type === "CredentialsSignin") {
      redirect("/login?error=credentials");
    }
    throw error;
  }
}
