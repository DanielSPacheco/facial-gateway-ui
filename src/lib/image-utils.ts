// image-utils.ts - Optimization for facial recognition devices

export async function fileToCompressedDataUrl(file: File) {
    const imgUrl = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = imgUrl;
    });

    // Aggressive scaling
    let w = img.width;
    let h = img.height;

    // Constraint: Firmware request limit implies a very small payload.
    // Target Base64 length < 12,500 chars to ensure successful transmission.
    // Starting with 140px based on device constraints.
    const maxW = 140;

    if (w > maxW) {
        const scale = maxW / w;
        w = Math.round(w * scale);
        h = Math.round(h * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas não suportado");

    // Use white background for transparency handling
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);

    // Draw image
    ctx.drawImage(img, 0, 0, w, h);

    // Initial attempt
    let dataUrl = canvas.toDataURL("image/jpeg", 0.6);

    // Strict Limit: 12,500 chars (Safety margin for JSON payload)
    const MAX_CHARS = 12500;

    if (dataUrl.length > MAX_CHARS) {
        // Retry 1: Lower quality
        dataUrl = canvas.toDataURL("image/jpeg", 0.5);
    }

    if (dataUrl.length > MAX_CHARS) {
        // Retry 2: Smaller size (100px)
        const scale2 = 0.7; // 140 * 0.7 ~= 98px
        const w2 = Math.round(w * scale2);
        const h2 = Math.round(h * scale2);

        canvas.width = w2;
        canvas.height = h2;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, w2, h2);
        ctx.drawImage(img, 0, 0, w2, h2);

        dataUrl = canvas.toDataURL("image/jpeg", 0.5);
    }

    if (dataUrl.length > MAX_CHARS) {
        // Retry 3: Tiny size (80px) and low quality
        const scale3 = 0.5; // 140 * 0.5 = 70px
        const w3 = Math.round(w * scale3);
        const h3 = Math.round(h * scale3);

        canvas.width = w3;
        canvas.height = h3;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, w3, h3);
        ctx.drawImage(img, 0, 0, w3, h3);

        dataUrl = canvas.toDataURL("image/jpeg", 0.4);
    }

    // Logging for debug
    // console.log(`Compressed: ${w}x${h} -> ${dataUrl.length} chars (Target < ${MAX_CHARS})`);

    URL.revokeObjectURL(imgUrl);

    // Approximate size in bytes
    const base64Content = dataUrl.split(",")[1] || "";
    const bytes = Math.floor((base64Content.length * 3) / 4);

    return { dataUrl, bytes };
}
