"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  orgId?: string;
  onCreateTag?: (name: string) => Promise<void>;
}

export function TagInput({
  value,
  onChange,
  placeholder = "Add tags...",
  orgId,
  onCreateTag,
}: TagInputProps) {
  const [input, setInput] = useState("");
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (orgId) {
      loadTags();
    }
  }, [orgId]);

  const loadTags = async () => {
    if (!orgId) return;
    setIsLoadingTags(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/supplier-tags`);
      if (res.ok) {
        const data = await res.json();
        setAvailableTags(data.tags.map((t: { name: string }) => t.name));
      }
    } catch (err) {
      console.error("Failed to load tags:", err);
    } finally {
      setIsLoadingTags(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    setShowSuggestions(e.target.value.length > 0);
  };

  const handleAddTag = async (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;

    // Check if tag already added
    if (value.includes(trimmed)) {
      setInput("");
      return;
    }

    // Try to create tag if it doesn't exist
    if (orgId && onCreateTag && !availableTags.includes(trimmed)) {
      try {
        await onCreateTag(trimmed);
        setAvailableTags([...availableTags, trimmed]);
      } catch (err) {
        console.error("Failed to create tag:", err);
        return;
      }
    }

    onChange([...value, trimmed]);
    setInput("");
    setShowSuggestions(false);
  };

  const handleRemoveTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddTag(input);
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      handleRemoveTag(value[value.length - 1]);
    }
  };

  const suggestions = availableTags.filter(
    (tag) => !value.includes(tag) && tag.toLowerCase().includes(input.toLowerCase()),
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          placeholder={placeholder}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => input && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          disabled={isLoadingTags}
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-md shadow-md z-10 mt-1 max-h-40 overflow-y-auto">
            {suggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleAddTag(tag)}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="hover:opacity-70"
                type="button"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
