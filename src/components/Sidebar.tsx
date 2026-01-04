"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, HardDrive, Building, ShieldCheck, Settings, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const sidebarItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Unidades", href: "/units", icon: Building }, // New for Resident Org
    { label: "Pessoas", href: "/users", icon: Users },
    { label: "Equipamentos", href: "/devices", icon: HardDrive },
];

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    return (
        <div className="h-screen w-64 bg-card border-r border-border flex flex-col fixed left-0 top-0 z-40">
            {/* Header */}
            <div className="h-16 flex items-center px-6 border-b border-border">
                <div className="flex items-center gap-2 font-bold text-lg tracking-tight text-foreground">
                    <ShieldCheck className="h-6 w-6 text-primary" />
                    <span>Gate<span className="text-primary">Flow</span></span>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {sidebarItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground/70")} />
                            {item.label}
                        </Link>
                    )
                })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-border space-y-1">
                <Link
                    href="/settings"
                    className="flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                    <Settings className="h-5 w-5 text-muted-foreground/70" />
                    Configurações
                </Link>
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium text-red-400 hover:bg-red-900/10 hover:text-red-300 transition-colors text-left"
                >
                    <LogOut className="h-5 w-5" />
                    Sair
                </button>
            </div>
        </div>
    );
}
