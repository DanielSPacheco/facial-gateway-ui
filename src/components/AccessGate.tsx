"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const operatorBlockedPrefixes = [
  "/devices",
  "/rules",
  "/logs",
  "/settings",
  "/integrations",
];

function isBlockedForOperator(pathname: string) {
  return operatorBlockedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

export function AccessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const loadRole = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      setRole(data?.role || null);
      setLoading(false);
    };

    loadRole();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (role === "operator" && isBlockedForOperator(pathname)) {
      router.replace("/dashboard");
    }
  }, [loading, role, pathname, router]);

  if (loading) return null;
  if (role === "operator" && isBlockedForOperator(pathname)) return null;

  return <>{children}</>;
}
