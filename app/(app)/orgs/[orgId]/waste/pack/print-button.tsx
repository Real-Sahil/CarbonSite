"use client";

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="h-9 rounded-md bg-gray-900 px-3 text-sm text-white">Print or save as PDF</button>;
}
