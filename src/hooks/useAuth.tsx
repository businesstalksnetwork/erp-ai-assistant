import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: string[];
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TENANT_STORAGE_KEY = "selectedTenantId";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);
  const fetchIdRef = useRef(0); // cancellation token for stale role fetches

  // Thin auth state listener — no DB calls inside callback
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (!session) {
          setRoles([]);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Separate effect: fetch roles when user changes (avoids onAuthStateChange deadlock)
  useEffect(() => {
    if (!user) return;

    const id = ++fetchIdRef.current;

    const fetchRoles = async () => {
      try {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        // Only apply if this is still the latest fetch (prevents race conditions)
        if (id === fetchIdRef.current) {
          setRoles(data?.map((r) => r.role) ?? []);
        }
      } catch (err) {
        console.error("Failed to fetch user roles:", err);
        if (id === fetchIdRef.current) {
          setRoles([]);
        }
      } finally {
        if (id === fetchIdRef.current) {
          setLoading(false);
        }
      }
    };

    fetchRoles();
  }, [user?.id]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRoles([]);
    // Clear tenant selection to prevent stale state on re-login
    localStorage.removeItem(TENANT_STORAGE_KEY);
  };

  const isSuperAdmin = roles.includes("super_admin");

  return (
    <AuthContext.Provider value={{ user, session, loading, roles, isSuperAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
