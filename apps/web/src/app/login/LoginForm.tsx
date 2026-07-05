"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "./actions";
import { Badge } from "@/components/ui/Badge";
import { useTheme } from "@/components/ui/ThemeProvider";
import { IconEye, IconEyeOff, IconMoon, IconSun } from "@/components/ui/Icons";

function loginErrorMessage(errorCode: string | undefined, authMode: string): string {
  if (errorCode === "service") {
    return authMode === "ldap"
      ? "El directorio LDAP no responde. Inténtalo más tarde o contacta con sistemas."
      : "El servicio de autenticación no está disponible. Inténtalo más tarde.";
  }
  if (errorCode === "credentials") {
    return "Usuario o contraseña incorrectos. Comprueba tus credenciales e inténtalo de nuevo.";
  }
  return "No se pudo iniciar sesión. Comprueba tus credenciales e inténtalo de nuevo.";
}

function authModeLabel(authMode: string): string {
  if (authMode === "ldap") return "LDAP / Active Directory";
  return "Local (desarrollo)";
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending} aria-busy={pending}>
      {pending ? "Iniciando sesión…" : "Iniciar sesión"}
    </button>
  );
}

export function LoginForm({
  authMode,
  errorCode,
  callbackUrl,
  sessionExpired,
}: {
  authMode: string;
  errorCode?: string;
  callbackUrl?: string;
  sessionExpired?: boolean;
}) {
  const { theme, toggle } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const hasError = !!errorCode;
  const safeCallback = callbackUrl?.startsWith("/") ? callbackUrl : undefined;

  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-6">
        <Badge variant="muted">{authModeLabel(authMode)}</Badge>
        <button
          type="button"
          onClick={toggle}
          className="btn-ghost btn-sm"
          aria-label={theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"}
        >
          {theme === "dark" ? <IconSun className="w-4 h-4" /> : <IconMoon className="w-4 h-4" />}
          {theme === "dark" ? "Claro" : "Oscuro"}
        </button>
      </div>

      {sessionExpired && !hasError && (
        <div
          className="mb-4 p-3 rounded-md bg-status-warn/10 border border-status-warn/30 text-status-warn text-sm"
          role="status"
        >
          Tu sesión ha expirado. Inicia sesión de nuevo para continuar.
        </div>
      )}

      {safeCallback && !hasError && !sessionExpired && (
        <div className="mb-4 p-3 rounded-md bg-surface-1 border border-stroke-subtle text-text-secondary text-sm">
          Inicia sesión para continuar en la página que solicitaste.
        </div>
      )}

      {hasError && (
        <div
          className="mb-4 p-3 rounded-md bg-status-error/10 border border-status-error/30 text-status-error text-sm"
          role="alert"
          aria-live="assertive"
        >
          {loginErrorMessage(errorCode, authMode)}
        </div>
      )}

      <form action={loginAction} className="space-y-4">
        {safeCallback && <input type="hidden" name="callbackUrl" value={safeCallback} />}

        <div>
          <label htmlFor="username" className="block text-sm text-text-secondary mb-1.5">
            Usuario
          </label>
          <input
            id="username"
            name="username"
            type="text"
            required
            autoFocus
            autoComplete="username"
            className="input-field"
            placeholder={authMode === "ldap" ? "usuario.ad" : "admin"}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm text-text-secondary mb-1.5">
            Contraseña
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              className="input-field pr-10"
              onKeyDown={(e) => setCapsLock(e.getModifierState("CapsLock"))}
              onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <IconEyeOff /> : <IconEye />}
            </button>
          </div>
          {capsLock && (
            <p className="text-xs text-status-warn mt-1.5" role="status">
              Bloq Mayús activado
            </p>
          )}
        </div>

        <SubmitButton />
      </form>
    </>
  );
}
