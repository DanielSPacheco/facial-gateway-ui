export default function ResidentLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen flex-col">
            <header className="border-b px-6 py-4">
                <h1 className="text-xl font-bold">Resident Portal</h1>
            </header>
            <main className="flex-1 overflow-auto bg-background">
                {children}
            </main>
        </div>
    );
}
