import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";

export type UserRole = "admin" | "editor" | "lector";

declare module "next-auth" {
  interface User {
    role?: UserRole;
    department?: string;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: UserRole;
      department?: string;
    };
  }
}

const authMode = process.env.AUTH_MODE ?? "local";

const localProvider = Credentials({
  id: "local",
  name: "Desarrollo local",
  credentials: {
    username: { label: "Usuario", type: "text" },
    password: { label: "Contraseña", type: "password" },
  },
  async authorize(credentials) {
    const username = credentials?.username as string;
    const password = credentials?.password as string;

    const expectedUser = process.env.LOCAL_AUTH_USERNAME ?? "admin";
    const expectedPass = process.env.LOCAL_AUTH_PASSWORD ?? "admin";

    if (username === expectedUser && password === expectedPass) {
      return {
        id: "local-admin",
        name: "Administrador local",
        email: "admin@wikibridge.local",
        role: (process.env.LOCAL_AUTH_ROLE as UserRole) ?? "admin",
        department: "Sistemas",
      };
    }
    return null;
  },
});

const ldapProvider = Credentials({
  id: "ldap",
  name: "Active Directory",
  credentials: {
    username: { label: "Usuario AD", type: "text" },
    password: { label: "Contraseña", type: "password" },
  },
  async authorize(credentials) {
    const username = credentials?.username as string;
    const password = credentials?.password as string;
    if (!username || !password) return null;

    const apiBase = process.env.INTERNAL_API_URL || "http://api:8000";
    try {
      const response = await fetch(`${apiBase}/api/auth/ldap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!data.ok || !data.user) return null;
      return {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role ?? "lector",
        department: data.user.department,
      };
    } catch {
      return null;
    }
  },
});

export const authConfig: NextAuthConfig = {
  providers: authMode === "ldap" ? [ldapProvider] : [localProvider],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role ?? "lector";
        token.department = user.department;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.role = (token.role as UserRole) ?? "lector";
      session.user.department = token.department as string | undefined;
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = nextUrl.pathname.startsWith("/login");

      if (isLoginPage) {
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true;
      }

      if (!isLoggedIn) {
        const loginUrl = new URL("/login", nextUrl);
        loginUrl.searchParams.set("sessionExpired", "1");
        const callback = nextUrl.pathname + nextUrl.search;
        if (callback !== "/") {
          loginUrl.searchParams.set("callbackUrl", callback);
        }
        return Response.redirect(loginUrl);
      }

      return true;
    },
  },
  trustHost: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
