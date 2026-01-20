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
            <main className="min-h-screen pt-14 md:pt-0 md:pl-64">
                <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                    <AccessGate>{children}</AccessGate>
                </div>
            </main>
            <Toaster position="top-right" richColors />
        </div>
    );
}
