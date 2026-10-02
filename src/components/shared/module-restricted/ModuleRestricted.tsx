"use client";

import * as React from "react";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ModuleRestrictedProps {
  title?: string;
  description?: string;
  redirectUrl?: string;
  buttonText?: string;
  className?: string;
}

export function ModuleRestricted({
  title = "Access Restricted",
  description = "You do not have the required permissions to view this module. This area is strictly restricted to Department Heads and Division Supervisors.",
  redirectUrl = "/dashboard",
  buttonText = "Return to Dashboard",
  className = "",
}: ModuleRestrictedProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center h-[calc(100vh-6rem)] p-4 text-center animate-in fade-in zoom-in-95 duration-500 ${className}`}
    >
      <div className="bg-destructive/10 p-6 rounded-full mb-6 ring-4 ring-destructive/5">
        <ShieldAlert className="h-16 w-16 text-destructive" />
      </div>
      <h1 className="text-4xl font-black tracking-tight text-foreground">{title}</h1>
      <p className="text-muted-foreground mt-3 max-w-lg font-medium text-lg">
        {description}
      </p>
      <Button
        className="mt-8 rounded-full font-bold shadow-lg flex items-center gap-2"
        onClick={() => (window.location.href = redirectUrl)}
        variant="default"
        size="lg"
      >
        <ArrowLeft className="h-5 w-5" />
        {buttonText}
      </Button>
    </div>
  );
}

export default ModuleRestricted;
