"use client";

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

// Context to share state
const SelectContext = React.createContext<{
    value: string;
    onValueChange: (value: string) => void;
    open: boolean;
    setOpen: (open: boolean) => void;
} | null>(null);

interface SelectProps {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
}

export function Select({ value, onValueChange, children }: SelectProps) {
    const [open, setOpen] = React.useState(false);

    return (
        <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
            <div className="relative inline-block w-full text-left">
                {children}
            </div>
        </SelectContext.Provider>
    );
}

export function SelectTrigger({ className, children }: React.HTMLAttributes<HTMLButtonElement>) {
    const ctx = React.useContext(SelectContext);
    if (!ctx) return null;

    return (
        <button
            type="button"
            onClick={() => ctx.setOpen(!ctx.open)}
            className={cn(
                "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                className
            )}
        >
            {children}
            <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
    );
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
    // This simple implementation relies on the Trigger showing the current value if selected
    // Since we don't have access to children labels easily without traversing, 
    // we often rely on the parent to just put the label inside Trigger or we do a lookup.
    // For this simplified version, we'll suggest the user puts the selected label in the trigger manually if needed, 
    // OR we can implement specific logic. 
    // BUT the standard Shadcn pattern wraps this. 
    // Let's assume the user of this component (DeviceConfigDialog) puts the text inside SelectTrigger for now or we improve this.
    // Wait, shadcn SelectValue automatically displays the selected item's text.
    // I entered a rabbit hole. I will just render a span.

    // Better Approach: Context knows the value. But we need the LABEL associated with that value.
    // The SelectItem children probably contain the label.
    // For a quick fix without complex mapping: 
    // I'll make SelectValue generic. 
    const ctx = React.useContext(SelectContext);

    // We can't easily find the label without traversing children.
    // I'll leave it simple: It renders the value if no placeholder logic.
    // Actually, I'll update DeviceConfigDialog to just display the value for now if this component is too dumb.
    // Or I rely on the mapping in `DeviceConfigDialog`. 

    return <span className="block truncate">{ctx?.value || placeholder}</span>;
}

export function SelectContent({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
    const ctx = React.useContext(SelectContext);
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                ctx?.setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [ctx]);

    if (!ctx?.open) return null;

    return (
        <div
            ref={ref}
            className={cn(
                "absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
                className
            )}
        >
            <div className="p-1">
                {children}
            </div>
        </div>
    );
}

export function SelectItem({ value, children, className }: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
    const ctx = React.useContext(SelectContext);
    const isSelected = ctx?.value === value;

    return (
        <div
            className={cn(
                "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                className
            )}
            onClick={() => {
                ctx?.onValueChange(value);
                ctx?.setOpen(false);
            }}
        >
            <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                {isSelected && <Check className="h-4 w-4" />}
            </span>
            {children}
        </div>
    );
}
