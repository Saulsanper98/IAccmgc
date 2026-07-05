import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string; sessionExpired?: string }>;
}) {
  const session = await auth();
  if (session) {
    redirect("/");
  }

  const params = await searchParams;
  const authMode = process.env.AUTH_MODE ?? "local";

  return (
    <div className="min-h-screen flex flex-col bg-surface-0">
      <a href="#login-form" className="skip-link">
        Ir al formulario de acceso
      </a>

      <div className="flex-1 flex items-center justify-center p-6">
        <div id="login-form" className="w-full max-w-sm">
          <div className="text-center mb-10">
            <img
              src="/favicon.svg"
              alt=""
              width={56}
              height={56}
              className="mx-auto mb-4 rounded-2xl"
              aria-hidden
            />
            <p className="text-xs font-medium text-text-muted uppercase tracking-widest mb-2">CCMGC · Sistemas</p>
            <h1 className="brand-title text-2xl font-semibold tracking-tight">WikiBridge</h1>
            <p className="text-text-secondary text-sm mt-2">Acceso al conocimiento vivo de tu wiki</p>
          </div>

          <LoginForm
            authMode={authMode}
            errorCode={params.error}
            callbackUrl={params.callbackUrl}
            sessionExpired={params.sessionExpired === "1"}
          />

          {authMode === "local" && (
            <p className="text-xs text-text-muted text-center mt-8 leading-relaxed">
              Modo desarrollo. Credenciales en{" "}
              <code className="text-text-secondary">LOCAL_AUTH_*</code>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
