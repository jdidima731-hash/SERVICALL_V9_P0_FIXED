import React from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Info  } from 'lucide-react';
import { GLOSSARY } from "@/lib/ux-improvements";

interface GlossaryTermProps {
  termKey: keyof typeof GLOSSARY;
  children?: React.ReactNode;
}

export function GlossaryTerm({ termKey, children }: GlossaryTermProps) {
  const item = GLOSSARY[termKey];

  if (!item) return <>{children}</>;

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <span className="inline-flex items-center gap-1 cursor-help border-b border-dotted border-primary/50 hover:text-primary transition-colors">
          {children || item.term}
          <Info className="w-3 h-3 text-muted-foreground" />
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 p-4 shadow-xl border-primary/10">
        <div className="space-y-2">
          <h4 className="text-sm font-bold flex items-center gap-2 text-primary">
            <Info className="w-4 h-4" />
            {item.term}
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {item.definition}
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
