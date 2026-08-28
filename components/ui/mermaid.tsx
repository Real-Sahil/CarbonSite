"use client";

import { useEffect, useRef } from "react";
import mermaid from "mermaid";

interface MermaidProps {
  diagram: string;
  className?: string;
}

export default function Mermaid({ diagram, className = "" }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const renderDiagram = async () => {
      try {
        mermaid.initialize({ startOnLoad: true, theme: "default" });
        mermaid.contentLoaded();
        
        const { svg } = await mermaid.render("mermaid-diagram", diagram);
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (error) {
        console.error("Mermaid rendering failed:", error);
        if (containerRef.current) {
          containerRef.current.innerHTML = `<p className="text-red-600">Failed to render diagram</p>`;
        }
      }
    };

    renderDiagram();
  }, [diagram]);

  return (
    <div ref={containerRef} className={`flex justify-center ${className}`}>
      <div className="animate-pulse">Loading diagram...</div>
    </div>
  );
}
