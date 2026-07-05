"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

export async function loginAction(formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const callbackUrl = (formData.get("callbackUrl") as string) || "/";
  const authMode = process.env.AUTH_MODE ?? "local";

  try {
    await signIn(authMode === "ldap" ? "ldap" : "local", {
      username,
      password,
      redirectTo: callbackUrl.startsWith("/") ? callbackUrl : "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const params = new URLSearchParams();
      if (error.type === "CredentialsSignin") {
        params.set("error", "credentials");
      } else {
        params.set("error", "service");
      }
      if (callbackUrl.startsWith("/") && callbackUrl !== "/") {
        params.set("callbackUrl", callbackUrl);
      }
      redirect(`/login?${params.toString()}`);
    }
    throw error;
  }
}
