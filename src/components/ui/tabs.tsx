"use client";

import * as React from "react"
import { cn } from "@/lib/utils"

const Tabs = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("w-full", className)} {...props} />
))
Tabs.displayName = "Tabs"

const TabsList = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
            className
        )}
        {...props}
    />
))
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string; activeValue?: string; setActiveValue?: (v: string) => void }
>(({ className, value, activeValue, setActiveValue, onClick, ...props }, ref) => {
    const isActive = activeValue === value;
    return (
        <button
            ref={ref}
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                isActive && "bg-background text-foreground shadow",
                className
            )}
            onClick={(e) => {
                if (setActiveValue) setActiveValue(value);
                if (onClick) onClick(e);
            }}
            type="button"
            {...props}
        />
    )
})
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { value: string; activeValue?: string }
>(({ className, value, activeValue, ...props }, ref) => {
    if (value !== activeValue) return null;
    return (
        <div
            ref={ref}
            className={cn(
                "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                className
            )}
            {...props}
        />
    )
})
TabsContent.displayName = "TabsContent"

// Wrapper to manage state conveniently (Updated for Controlled/Uncontrolled)
interface TabsRootProps {
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
    className?: string;
}

function TabsRoot({ defaultValue, value, onValueChange, children, className }: TabsRootProps) {
    const [internalTab, setInternalTab] = React.useState(defaultValue || "");

    const isControlled = value !== undefined;
    const activeTab = isControlled ? value : internalTab;

    const handleTabChange = (newValue: string) => {
        if (!isControlled) {
            setInternalTab(newValue);
        }
        if (onValueChange) {
            onValueChange(newValue);
        }
    };

    return (
        <div className={className}>
            {React.Children.map(children, child => {
                if (React.isValidElement(child)) {
                    // Inject props into List and Content
                    if (child.type === TabsList) {
                        return React.cloneElement(child, {
                            children: React.Children.map((child as React.ReactElement<any>).props.children, trigger => {
                                if (React.isValidElement(trigger)) {
                                    return React.cloneElement(trigger as any, { activeValue: activeTab, setActiveValue: handleTabChange });
                                }
                                return trigger;
                            })
                        } as any);
                    }
                    if (child.type === TabsContent) {
                        return React.cloneElement(child as any, { activeValue: activeTab });
                    }
                }
                return child;
            })}
        </div>
    );
}

export { TabsRoot as Tabs, TabsList, TabsTrigger, TabsContent }
