// image-utils.ts - Optimization for facial recognition devices
// STRICT LIMIT: Total Payload < 14000 bytes.
// We target Base64 < 12500 chars (approx 9.5KB binary).

export async function fileToCompressedDataUrl(file: File) {
    const imgUrl = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = imgUrl;
    });

    let w = img.width;
    let h = img.height;

    // Start with a reasonable max width
    const maxW = 320;
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

    // Helper to draw
    const draw = (width: number, height: number) => {
        canvas.width = width;
        canvas.height = height;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
    };

    // Target: 12500 chars (Safety margin for 14KB total payload)
    const MAX_CHARS = 12500;

    // Initial: 320px
    draw(w, h);

    // Start with quality 0.6
    let dataUrl = canvas.toDataURL("image/jpeg", 0.6);

    // Iterative reduction
    if (dataUrl.length > MAX_CHARS) {
        // Attempt 2: Lower quality
        dataUrl = canvas.toDataURL("image/jpeg", 0.4);
    }

    if (dataUrl.length > MAX_CHARS) {
        // Attempt 3: Reduce size to 240px
        const w2 = 240;
        const h2 = Math.round(img.height * (240 / img.width));
        draw(w2, h2);
        dataUrl = canvas.toDataURL("image/jpeg", 0.5);
    }

    if (dataUrl.length > MAX_CHARS) {
        // Attempt 4: Reduce to 200px
        const w3 = 200;
        const h3 = Math.round(img.height * (200 / img.width));
        draw(w3, h3);
        dataUrl = canvas.toDataURL("image/jpeg", 0.5);
    }

    if (dataUrl.length > MAX_CHARS) {
        // Attempt 5: Emergency Low (160px) and Low Quality
        const w4 = 160;
        const h4 = Math.round(img.height * (160 / img.width));
        draw(w4, h4);
        dataUrl = canvas.toDataURL("image/jpeg", 0.4);
    }

    // Sanity check log
    // console.log(`Final Size: ${dataUrl.length} chars (Target < ${MAX_CHARS})`);

    URL.revokeObjectURL(imgUrl);

    // Approximate size in bytes
    const base64Content = dataUrl.split(",")[1] || "";
    const bytes = Math.floor((base64Content.length * 3) / 4);

    return { dataUrl, bytes };
}
