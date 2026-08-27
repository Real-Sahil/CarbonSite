"use client";

import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface EmissionCategory {
  code: string;
  name: string;
  scope: number;
}

interface CategorySelectorProps {
  value: string[];
  onChange: (categories: string[]) => void;
  disabled?: boolean;
}

const CATEGORIES: EmissionCategory[] = [
  { code: "s1-stationary", name: "Stationary Energy", scope: 1 },
  { code: "s1-mobile", name: "Mobile Energy", scope: 1 },
  { code: "s1-fugitive", name: "Fugitive Emissions", scope: 1 },
  { code: "s2-electricity-lb", name: "Electricity (Location-Based)", scope: 2 },
  { code: "s2-electricity-mb", name: "Electricity (Market-Based)", scope: 2 },
  { code: "s3-business-travel", name: "Business Travel", scope: 3 },
  { code: "s3-commuting", name: "Commuting", scope: 3 },
  { code: "s3-purchased-goods", name: "Purchased Goods & Services", scope: 3 },
  { code: "s3-upstream-transport", name: "Upstream Transportation", scope: 3 },
];

export function CategorySelector({ value, onChange, disabled }: CategorySelectorProps) {
  const handleToggle = (code: string) => {
    if (value.includes(code)) {
      onChange(value.filter((c) => c !== code));
    } else {
      onChange([...value, code]);
    }
  };

  const scopeGroups = {
    1: CATEGORIES.filter((c) => c.scope === 1),
    2: CATEGORIES.filter((c) => c.scope === 2),
    3: CATEGORIES.filter((c) => c.scope === 3),
  };

  return (
    <div className="space-y-4">
      {[1, 2, 3].map((scope) => (
        <div key={`scope-${scope}`}>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Scope {scope}</h3>
          <div className="space-y-2 ml-2">
            {scopeGroups[scope as 1 | 2 | 3].map((category) => (
              <div key={category.code} className="flex items-center gap-2">
                <Checkbox
                  id={category.code}
                  checked={value.includes(category.code)}
                  onCheckedChange={() => handleToggle(category.code)}
                  disabled={disabled}
                />
                <Label
                  htmlFor={category.code}
                  className="text-sm cursor-pointer"
                >
                  {category.name}
                </Label>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
