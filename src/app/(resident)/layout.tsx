export default function ResidentLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen flex-col">
            <header className="border-b px-4 py-4 sm:px-6">
                <h1 className="text-xl font-bold">Resident Portal</h1>
            </header>
            <main className="flex-1 overflow-auto bg-background px-4 py-6 sm:px-6">
                {children}
            </main>
        </div>
    );
}
