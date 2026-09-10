import { create } from "zustand";
import { api } from "@/lib/api";
import type { Role, User } from "@/types";

interface AuthState {
  user: User | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, role: Role) => Promise<User>;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  async hydrate() {
    const t = localStorage.getItem("codeta_token");
    if (!t) {
      set({ user: null, hydrated: true });
      return;
    }
    try {
      const user = await api<User>("/me");
      set({ user, hydrated: true });
    } catch {
      localStorage.removeItem("codeta_token");
      set({ user: null, hydrated: true });
    }
  },
  async login(email, password) {
    const res = await api<{ token: string; role: Role }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem("codeta_token", res.token);
    const user: User = { id: 0, email, role: res.role };
    set({ user });
    return user;
  },
  async register(email, password, role) {
    const res = await api<{ id: number; role: Role }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, role }),
    });
    const user: User = { id: res.id, email, role: res.role };
    return user;
  },
  logout() {
    localStorage.removeItem("codeta_token");
    set({ user: null });
  },
}));

export function homePath(role?: Role) {
  if (role === "admin") return "/admin/dashboard";
  if (role === "reviewer") return "/reviewer/projects";
  return "/student/projects";
}
