"use client";

import { Button } from "@/components/ui/button";

export function PrintButton() {
  return <Button type="button" onClick={() => window.print()} className="px-3">Print or save as PDF</Button>;
}
