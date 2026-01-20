"use client";

import { useState, useEffect } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Users,
    HardDrive,
    Building,
    ShieldCheck,
    Settings,
    LogOut,
    FileKey,    // Regras
    FileClock,  // Logs
    Workflow,   // Integracoes
    Menu,
    X
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

// Define section structure
const sidebarGroups = [
    {
        title: "Operação",
        items: [
            { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
            { label: "Unidades", href: "/units", icon: Building },
            { label: "Pessoas", href: "/users", icon: Users },
            { label: "Equipamentos", href: "/devices", icon: HardDrive },
        ]
    },
    {
        title: "Gestão & Logs",
        items: [
            { label: "Regras", href: "/rules", icon: FileKey },
            { label: "Logs", href: "/logs", icon: FileClock },
            { label: "Equipe", href: "/settings/team", icon: ShieldCheck },
            { label: "Integrações", href: "/integrations", icon: Workflow },
            { label: "Configurações", href: "/settings", icon: Settings },
        ]
    }
];

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [role, setRole] = useState<string | null>(null);
    const [loadingRole, setLoadingRole] = useState(true);
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
        setMobileOpen(false);
    };

    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        const loadRole = async () => {
            const { data: userData } = await supabase.auth.getUser();
            const userId = userData?.user?.id;
            if (!userId) {
                setLoadingRole(false);
                return;
            }

            const { data } = await supabase
                .from("users")
                .select("role")
                .eq("user_id", userId)
                .maybeSingle();

            setRole(data?.role || null);
            setLoadingRole(false);
        };

        loadRole();
    }, []);

    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    if (!isMounted) {
        return (
            <>
                <div className="md:hidden h-14 bg-card border-b border-border" />
                <div className="hidden md:flex h-screen w-64 bg-card border-r border-border fixed left-0 top-0 z-40" />
            </>
        );
    }

    const filteredGroups = sidebarGroups.map((group) => {
        if (role !== "operator") return group;
        const blocked = new Set([
            "Equipamentos",
            "Regras",
            "Logs",
            "Equipe",
            "Integrações",
            "Configurações",
        ]);
        return {
            ...group,
            items: group.items.filter((item) => !blocked.has(item.label)),
        };
    });

    const handleNavigate = () => setMobileOpen(false);

    const sidebarHeader = (
        <div className="h-16 flex items-center justify-between px-6 border-b border-border mb-4">
            <div className="flex items-center gap-2 font-bold text-lg tracking-tight text-foreground">
                <ShieldCheck className="h-6 w-6 text-primary" />
                <span>FS<span className="text-primary">Automation</span></span>
            </div>
            <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="md:hidden inline-flex items-center justify-center rounded-md border border-border bg-background px-2.5 py-2 text-sm text-foreground"
                aria-label="Fechar menu"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );

    const sidebarContent = (
        <>
            {sidebarHeader}

            <nav className="flex-1 px-4 space-y-6 overflow-y-auto">
                {filteredGroups.map((group) => (
                    <div key={group.title}>
                        <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                            {group.title}
                        </h3>
                        <div className="space-y-1">
                            {group.items.map((item) => {
                                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={handleNavigate}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                            isActive
                                                ? "bg-primary/10 text-primary"
                                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                        )}
                                    >
                                        <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground/70")} />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            <div className="p-4 border-t border-border mt-auto">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-red-400 hover:bg-red-900/10 hover:text-red-300 transition-colors text-left"
                >
                    <LogOut className="h-4 w-4" />
                    Sair
                </button>
            </div>
        </>
    );

    return (
        <>
            <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b border-border">
                <div className="flex h-14 items-center justify-between px-4">
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        <span>FSA</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setMobileOpen(true)}
                        className="inline-flex items-center justify-center rounded-md border border-border bg-background px-2.5 py-2 text-sm text-foreground"
                        aria-label="Abrir menu"
                    >
                        <Menu className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div
                className={cn(
                    "fixed inset-0 z-50 md:hidden transition-opacity",
                    mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
                )}
            >
                <button
                    type="button"
                    className="absolute inset-0 bg-black/50"
                    onClick={() => setMobileOpen(false)}
                    aria-label="Fechar menu"
                />
                <aside
                    className={cn(
                        "absolute left-0 top-0 h-full w-72 bg-card border-r border-border flex flex-col transition-transform",
                        mobileOpen ? "translate-x-0" : "-translate-x-full"
                    )}
                >
                    {sidebarContent}
                </aside>
            </div>

            <aside className="hidden md:flex h-screen w-64 bg-card border-r border-border flex-col fixed left-0 top-0 z-40">
                {sidebarContent}
            </aside>
        </>
    );
}
