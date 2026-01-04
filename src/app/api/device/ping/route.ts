import { NextResponse } from 'next/server';
import net from 'net';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const ip = searchParams.get('ip');
    const port = searchParams.get('port') || '80'; // Default to web port

    if (!ip) {
        return NextResponse.json({ status: 'error', message: 'IP address required' }, { status: 400 });
    }

    const checkConnection = (host: string, port: number, timeout = 2000): Promise<boolean> => {
        return new Promise((resolve) => {
            const socket = new net.Socket();

            socket.setTimeout(timeout);

            socket.on('connect', () => {
                socket.destroy();
                resolve(true);
            });

            socket.on('timeout', () => {
                socket.destroy();
                resolve(false);
            });

            socket.on('error', (err) => {
                socket.destroy();
                resolve(false);
            });

            socket.connect(port, host);
        });
    };

    try {
        const isOnline = await checkConnection(ip, parseInt(port as string));

        if (isOnline) {
            return NextResponse.json({ status: 'online', ip, timestamp: new Date().toISOString() });
        } else {
            return NextResponse.json({ status: 'offline', ip, timestamp: new Date().toISOString() }, { status: 503 }); // 503 Service Unavailable
        }
    } catch (error: any) {
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}
