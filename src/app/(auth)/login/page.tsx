"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ShieldCheck, Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const router = useRouter();

  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

  // Handle subtle 3D parallax effect on mouse move
  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    const x = (clientX - innerWidth / 2) / 25; // Divide to reduce intensity
    const y = (clientY - innerHeight / 2) / 25;
    setMousePosition({ x, y });
  };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background"
      onMouseMove={handleMouseMove}
    >
      {/* Dynamic Animated Background */}
      <div className="absolute inset-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[100px] animate-pulse delay-700" />
      </div>

      {/* 3D Tilt Container */}
      <div
        className="relative z-10 w-full max-w-md px-4 transition-transform duration-200 ease-out"
        style={{ transform: `rotateY(${mousePosition.x}deg) rotateX(${-mousePosition.y}deg)` }}
      >
        <div className="flex justify-center mb-8 animate-in fade-in zoom-in duration-1000">
          <div className="bg-primary/10 p-4 rounded-full ring-1 ring-primary/30 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <ShieldCheck className="h-12 w-12 text-primary drop-shadow-md" />
          </div>
        </div>

        <Card className="border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl ring-1 ring-white/5 animate-in slide-in-from-bottom-5 duration-700">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-3xl font-bold tracking-tight bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">
              GateFlow
            </CardTitle>
            <CardDescription className="text-white/50">
              Secure Access Control System
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <div className="p-3 text-sm text-red-400 bg-red-900/20 border border-red-900/50 rounded-md text-center animate-in shake">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2 group">
                  <label className="text-xs font-medium text-white/50 ml-1 uppercase tracking-wider group-focus-within:text-primary transition-colors">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-white/40 group-focus-within:text-primary transition-colors" />
                    <Input
                      type="email"
                      placeholder="admin@gateflow.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-10 h-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-primary/50 focus-visible:border-primary/50 transition-all hover:bg-white/10"
                    />
                  </div>
                </div>

                <div className="space-y-2 group">
                  <label className="text-xs font-medium text-white/50 ml-1 uppercase tracking-wider group-focus-within:text-primary transition-colors">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-white/40 group-focus-within:text-primary transition-colors" />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pl-10 h-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-primary/50 focus-visible:border-primary/50 transition-all hover:bg-white/10"
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? "Verifying..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-8 text-center text-xs text-white/20 animate-in fade-in duration-1000 delay-500">
          Protected by Facial Gateway Technology • v2.0
        </p>
      </div>
    </div>
  );
}