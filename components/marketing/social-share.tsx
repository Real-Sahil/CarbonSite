'use client';

import React, { useState } from 'react';
import { Share2, Link as LinkIcon, Linkedin, Twitter, Mail, Check } from 'lucide-react';

interface SocialShareProps {
  title: string;
  description: string;
  url: string;
  className?: string;
}

export function SocialShare({ title, description, url, className = '' }: SocialShareProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleTwitterShare = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, '_blank', 'width=600,height=400');
  };

  const handleLinkedinShare = () => {
    const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    window.open(linkedinUrl, '_blank', 'width=600,height=400');
  };

  const handleEmailShare = () => {
    const subject = `Check out: ${title}`;
    const body = `${description}\n\n${url}`;
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div className="flex items-center gap-2 text-gray-600">
        <Share2 className="w-5 h-5" />
        <span className="text-sm font-medium">Share:</span>
      </div>

      <div className="flex gap-2">
        {/* Twitter/X Share */}
        <button
          onClick={handleTwitterShare}
          className="p-2 rounded-lg bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-600 transition-colors"
          title="Share on Twitter/X"
        >
          <Twitter className="w-5 h-5" />
        </button>

        {/* LinkedIn Share */}
        <button
          onClick={handleLinkedinShare}
          className="p-2 rounded-lg bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-700 transition-colors"
          title="Share on LinkedIn"
        >
          <Linkedin className="w-5 h-5" />
        </button>

        {/* Email Share */}
        <button
          onClick={handleEmailShare}
          className="p-2 rounded-lg bg-gray-100 hover:bg-red-100 text-gray-700 hover:text-red-600 transition-colors"
          title="Share via email"
        >
          <Mail className="w-5 h-5" />
        </button>

        {/* Copy Link */}
        <button
          onClick={handleCopyLink}
          className={`p-2 rounded-lg transition-colors ${
            copied
              ? 'bg-green-100 text-green-600'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
          title="Copy link to clipboard"
        >
          {copied ? <Check className="w-5 h-5" /> : <LinkIcon className="w-5 h-5" />}
        </button>
      </div>

      {copied && <span className="text-sm text-green-600 font-medium">Copied to clipboard!</span>}
    </div>
  );
}

/**
 * Social sharing buttons row (horizontal layout)
 */
export function SocialShareRow({ title, description, url }: SocialShareProps) {
  return (
    <div className="flex gap-3 flex-wrap">
      <a
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-sm font-medium"
      >
        <Twitter className="w-4 h-4" />
        Share on X
      </a>

      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-sm font-medium"
      >
        <Linkedin className="w-4 h-4" />
        Share on LinkedIn
      </a>

      <a
        href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(description)}\n\n${encodeURIComponent(url)}`}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors text-sm font-medium"
      >
        <Mail className="w-4 h-4" />
        Share via Email
      </a>
    </div>
  );
}

/**
 * Minimal share button (icon only in toolbar)
 */
export function ShareButton({ title, description, url }: SocialShareProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
        title="Share this post"
      >
        <Share2 className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50">
          <div className="flex gap-2">
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Share on Twitter/X"
            >
              <Twitter className="w-4 h-4 text-blue-600" />
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Share on LinkedIn"
            >
              <Linkedin className="w-4 h-4 text-blue-700" />
            </a>
            <a
              href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(description)}\n\n${encodeURIComponent(url)}`}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Share via email"
            >
              <Mail className="w-4 h-4 text-gray-600" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
