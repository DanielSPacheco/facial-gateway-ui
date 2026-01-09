"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, Upload, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fileToCompressedDataUrl } from "@/lib/image-utils";

interface FaceUploadProps {
    currentPhoto?: string;
    onPhotoSelected: (base64: string) => void;
}

export function FaceUpload({ currentPhoto, onPhotoSelected }: FaceUploadProps) {
    const [preview, setPreview] = useState<string>(currentPhoto || "");
    const [isDragging, setIsDragging] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- LOGIC: Validate & Convert to JPG ---
    const processImage = async (file: File) => {
        if (!file.type.startsWith("image/")) {
            toast.error("Apenas arquivos de imagem são permitidos");
            return;
        }

        setProcessing(true);

        try {
            // Use the shared utility which handles aggressive compression (target < 14KB)
            const { dataUrl, bytes } = await fileToCompressedDataUrl(file);

            setPreview(dataUrl);
            setDimensions({ w: 0, h: 0 }); // Placeholder since we don't track exact dims during strict limit
            onPhotoSelected(dataUrl);

            toast.success(`Foto processada! Tamanho: ${(bytes / 1024).toFixed(1)}KB`);

        } catch (err) {
            console.error(err);
            toast.error("Erro ao processar imagem.");
        } finally {
            setProcessing(false);
        }
    };

    // --- HANDLERS ---
    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.[0]) {
            processImage(e.dataTransfer.files[0]);
        }
    }, []);

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            processImage(e.target.files[0]);
        }
    };

    const clearPhoto = (e: React.MouseEvent) => {
        e.stopPropagation(); // prevent triggering click on parent
        setPreview("");
        setDimensions(null);
        onPhotoSelected(""); // clear in parent
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <div className="space-y-3">
            <div
                className={`
                    relative group flex flex-col items-center justify-center 
                    p-6 border-2 border-dashed rounded-lg transition-all cursor-pointer 
                    min-h-[240px]
                    ${isDragging
                        ? 'border-emerald-500 bg-emerald-500/10 scale-[0.99]'
                        : 'border-muted hover:border-primary/50 hover:bg-muted/30'}
                `}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*" // Accept all images, we convert locally
                    onChange={onFileChange}
                />

                {processing ? (
                    <div className="flex flex-col items-center gap-3 animate-pulse">
                        <Upload className="h-10 w-10 text-muted-foreground" />
                        <p className="font-medium text-sm">Processando & Convertendo...</p>
                    </div>
                ) : preview ? (
                    <>
                        <div className="relative aspect-square w-48 h-48 rounded-md overflow-hidden border shadow-sm">
                            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                            {/* Hover Overlay */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2">
                                <Camera className="h-6 w-6" />
                                <span className="text-xs font-medium">Trocar Foto</span>
                            </div>
                        </div>

                        {/* Remove Button */}
                        <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={clearPhoto}
                        >
                            <X className="h-4 w-4" />
                        </Button>

                        {/* Metadata Badge */}
                        {/* {dimensions && (
                            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">
                                {dimensions.w}x{dimensions.h} • JPG
                            </div>
                        )} */}
                    </>
                ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground text-center">
                        <div className="bg-background p-3 rounded-full border shadow-sm mb-2">
                            <Camera className="h-8 w-8 text-primary" />
                        </div>
                        <p className="font-medium">
                            {isDragging ? "Solte a imagem aqui!" : "Clique ou arraste uma foto"}
                        </p>
                        <p className="text-xs max-w-[200px] text-muted-foreground/70">
                            Aceita PNG, JPEG, WebP. <br />
                            Convertido automaticamente para JPG.
                        </p>
                    </div>
                )}
            </div>

            {preview && (
                <div className="flex items-center gap-2 text-xs text-yellow-600 dark:text-yellow-500 bg-yellow-500/10 p-3 rounded-md border border-yellow-500/20">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Importante: Para melhor reconhecimento, use fundo branco e boa iluminação.</span>
                </div>
            )}
        </div>
    );
}
