"use client";

import { useState } from "react";
import { loginAction } from "./actions";
import { IconEye, IconEyeOff } from "@/components/ui/Icons";

export function LoginForm({
  authMode,
  hasError,
}: {
  authMode: string;
  hasError: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <>
      {hasError && (
        <div
          className="mb-4 p-3 rounded-md bg-status-error/10 border border-status-error/30 text-status-error text-sm"
          role="alert"
          aria-live="assertive"
        >
          Usuario o contraseña incorrectos. Comprueba tus credenciales e inténtalo de nuevo.
        </div>
      )}

      <form
        action={async (fd) => {
          setLoading(true);
          await loginAction(fd);
        }}
        className="space-y-4"
      >
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
        </div>

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Iniciando sesión…" : "Iniciar sesión"}
        </button>
      </form>
    </>
  );
}
