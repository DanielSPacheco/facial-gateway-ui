import { Sidebar } from "@/components/Sidebar";
import { Toaster } from "sonner";
import { AccessGate } from "@/components/AccessGate";

export default function AdminLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="min-h-screen bg-background">
            <Sidebar />
            <main className="pl-64 min-h-screen">
                <div className="p-8 max-w-7xl mx-auto">
                    <AccessGate>{children}</AccessGate>
                </div>
            </main>
            <Toaster position="top-right" richColors />
        </div>
    );
}
