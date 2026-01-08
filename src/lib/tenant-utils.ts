export function getTenantFromHostname(hostname: string): string | null {
    if (!hostname) return null;

    // Handle localhost (no subdomain usually, or sub.localhost)
    if (hostname.includes("localhost")) {
        const parts = hostname.split(".");
        // e.g. tenant.localhost -> parts = ['tenant', 'localhost']
        if (parts.length > 1 && parts[0] !== "www") {
            return parts[0];
        }
        return null;
    }

    // Handle IP addresses (no subdomain)
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
        return null;
    }

    const parts = hostname.split(".");
    // e.g. tenant.domain.com -> parts = ['tenant', 'domain', 'com']
    // We assume at least 3 parts for a valid subdomain on production
    // or checks against known base domains.
    // For simplicity, if parts > 2, take the first one.
    if (parts.length > 2) {
        // skip www
        if (parts[0] === "www") {
            // if www.tenant.domain.com ?? unlikely case for this app structure usually
            // if www.domain.com -> null
            return null;
        }
        return parts[0];
    }

    return null;
}
