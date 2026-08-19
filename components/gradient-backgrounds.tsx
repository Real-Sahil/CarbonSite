'use client';

export function HeroGradientBg() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="heroGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffa8" />
          <stop offset="50%" stopColor="#ffdc6e" />
          <stop offset="100%" stopColor="#ff9f43" />
        </linearGradient>
        <linearGradient id="heroGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff5e1" />
          <stop offset="100%" stopColor="#ffe0b2" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Main gradient background */}
      <rect width="1600" height="900" fill="url(#heroGrad1)" />
      <rect width="1600" height="900" fill="url(#heroGrad2)" opacity="0.4" />

      {/* Floating circles (renewable energy theme) */}
      <circle cx="200" cy="150" r="120" fill="#ffdc6e" opacity="0.3" filter="url(#glow)" />
      <circle cx="1400" cy="750" r="150" fill="#ff6b4c" opacity="0.2" filter="url(#glow)" />
      <circle cx="800" cy="800" r="200" fill="#ffffa8" opacity="0.15" filter="url(#glow)" />

      {/* Solar panel icon */}
      <g opacity="0.4" transform="translate(300, 200)">
        <rect x="0" y="0" width="40" height="40" fill="none" stroke="#ff6b4c" strokeWidth="2" />
        <rect x="5" y="5" width="8" height="8" fill="#ff6b4c" />
        <rect x="17" y="5" width="8" height="8" fill="#ff6b4c" />
        <rect x="29" y="5" width="8" height="8" fill="#ff6b4c" />
        <rect x="5" y="17" width="8" height="8" fill="#ff6b4c" />
        <rect x="17" y="17" width="8" height="8" fill="#ff6b4c" />
        <rect x="29" y="17" width="8" height="8" fill="#ff6b4c" />
      </g>

      {/* Wind turbine icon */}
      <g opacity="0.3" transform="translate(1350, 300)">
        <rect x="18" y="40" width="4" height="30" fill="#ffdc6e" />
        <polygon points="20,10 15,25 25,25" fill="#ffdc6e" />
        <polygon points="20,15 8,28 20,35" fill="#ffdc6e" opacity="0.7" />
      </g>

      {/* Lightning bolt icon */}
      <g opacity="0.35" transform="translate(150, 700)">
        <polygon points="20,0 15,20 25,20 10,45 15,25 5,25" fill="#ff0027" />
      </g>

      {/* Subtle wave pattern at bottom */}
      <path
        d="M 0 700 Q 400 680 800 700 T 1600 700 L 1600 900 L 0 900 Z"
        fill="rgba(255, 255, 255, 0.1)"
      />
    </svg>
  );
}

export function ProductGradientBg() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="prodGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f0f9ff" />
          <stop offset="50%" stopColor="#ffffa8" />
          <stop offset="100%" stopColor="#ffdc6e" />
        </linearGradient>
        <radialGradient id="prodRadial" cx="50%" cy="30%">
          <stop offset="0%" stopColor="#ffffa8" />
          <stop offset="100%" stopColor="#ff9f43" />
        </radialGradient>
      </defs>

      <rect width="1600" height="900" fill="url(#prodGrad)" />
      <circle cx="800" cy="200" r="400" fill="url(#prodRadial)" opacity="0.3" />

      {/* Measurement/analytics icons */}
      <g opacity="0.2" transform="translate(200, 150)">
        <rect x="0" y="40" width="8" height="40" fill="#ff6b4c" />
        <rect x="12" y="20" width="8" height="60" fill="#ff6b4c" />
        <rect x="24" y="30" width="8" height="50" fill="#ff6b4c" />
      </g>
    </svg>
  );
}

export function CalculationGradientBg() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="calcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fffbf0" />
          <stop offset="50%" stopColor="#ffdc6e" />
          <stop offset="100%" stopColor="#ff9f43" />
        </linearGradient>
      </defs>

      <rect width="1600" height="900" fill="url(#calcGrad)" />

      {/* Connected nodes visualization */}
      <circle cx="300" cy="200" r="30" fill="#ff6b4c" opacity="0.3" />
      <circle cx="800" cy="300" r="30" fill="#ffdc6e" opacity="0.3" />
      <circle cx="1300" cy="200" r="30" fill="#ff6b4c" opacity="0.3" />
      <line x1="330" y1="200" x2="770" y2="300" stroke="#ffdc6e" strokeWidth="2" opacity="0.2" />
      <line x1="830" y1="300" x2="1270" y2="200" stroke="#ff6b4c" strokeWidth="2" opacity="0.2" />
    </svg>
  );
}

export function ResourcesGradientBg() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="resGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffa8" />
          <stop offset="100%" stopColor="#fff5e1" />
        </linearGradient>
      </defs>

      <rect width="1600" height="900" fill="url(#resGrad)" />

      {/* Document/knowledge icons */}
      <g opacity="0.15" transform="translate(400, 250)">
        <rect x="0" y="0" width="60" height="80" fill="none" stroke="#ff6b4c" strokeWidth="3" />
        <line x1="10" y1="20" x2="50" y2="20" stroke="#ff6b4c" strokeWidth="2" />
        <line x1="10" y1="35" x2="50" y2="35" stroke="#ff6b4c" strokeWidth="2" />
        <line x1="10" y1="50" x2="50" y2="50" stroke="#ff6b4c" strokeWidth="2" />
      </g>

      <g opacity="0.12" transform="translate(1100, 250)">
        <rect x="0" y="0" width="60" height="80" fill="none" stroke="#ffdc6e" strokeWidth="3" />
        <line x1="10" y1="20" x2="50" y2="20" stroke="#ffdc6e" strokeWidth="2" />
        <line x1="10" y1="35" x2="50" y2="35" stroke="#ffdc6e" strokeWidth="2" />
        <line x1="10" y1="50" x2="50" y2="50" stroke="#ffdc6e" strokeWidth="2" />
      </g>
    </svg>
  );
}

export function ContactGradientBg() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="contactGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff5e1" />
          <stop offset="50%" stopColor="#ffffa8" />
          <stop offset="100%" stopColor="#ffdc6e" />
        </linearGradient>
      </defs>

      <rect width="1600" height="900" fill="url(#contactGrad)" />

      {/* Communication icons */}
      <g opacity="0.2" transform="translate(300, 300)">
        <circle cx="25" cy="25" r="25" fill="none" stroke="#ff6b4c" strokeWidth="2" />
        <path d="M 10 15 L 40 25 L 10 35 Z" fill="#ff6b4c" opacity="0.5" />
      </g>

      <g opacity="0.15" transform="translate(1250, 400)">
        <circle cx="25" cy="25" r="25" fill="none" stroke="#ff0027" strokeWidth="2" />
        <path d="M 10 15 L 40 25 L 10 35 Z" fill="#ff0027" opacity="0.5" />
      </g>
    </svg>
  );
}

export function FieldAppGradientBg() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="fieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fffbf0" />
          <stop offset="50%" stopColor="#ffdc6e" />
          <stop offset="100%" stopColor="#ff9f43" />
        </linearGradient>
      </defs>

      <rect width="1600" height="900" fill="url(#fieldGrad)" />

      {/* Mobile device icon */}
      <g opacity="0.2" transform="translate(200, 200)">
        <rect x="0" y="0" width="60" height="100" rx="5" fill="none" stroke="#ff6b4c" strokeWidth="3" />
        <rect x="5" y="5" width="50" height="70" fill="none" stroke="#ff6b4c" strokeWidth="2" />
        <circle cx="30" cy="85" r="3" fill="#ff6b4c" />
      </g>

      {/* Camera icon */}
      <g opacity="0.25" transform="translate(1300, 150)">
        <circle cx="25" cy="25" r="20" fill="none" stroke="#ffdc6e" strokeWidth="2" />
        <circle cx="25" cy="25" r="12" fill="none" stroke="#ffdc6e" strokeWidth="2" />
        <circle cx="25" cy="25" r="5" fill="#ffdc6e" />
        <rect x="45" y="15" width="8" height="20" fill="#ffdc6e" />
      </g>
    </svg>
  );
}

export function SecurityGradientBg() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="secGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffa8" />
          <stop offset="50%" stopColor="#ffdc6e" />
          <stop offset="100%" stopColor="#ff6b4c" />
        </linearGradient>
      </defs>

      <rect width="1600" height="900" fill="url(#secGrad)" />

      {/* Shield/lock icon */}
      <g opacity="0.2" transform="translate(400, 250)">
        <path d="M 25 5 L 45 15 L 45 40 Q 25 55 25 55 Q 5 40 5 15 Z" fill="none" stroke="#ff0027" strokeWidth="2" />
        <circle cx="25" cy="35" r="6" fill="none" stroke="#ff0027" strokeWidth="2" />
        <line x1="25" y1="35" x2="25" y2="45" stroke="#ff0027" strokeWidth="2" />
      </g>

      <g opacity="0.15" transform="translate(1200, 350)">
        <path d="M 25 5 L 45 15 L 45 40 Q 25 55 25 55 Q 5 40 5 15 Z" fill="none" stroke="#ffdc6e" strokeWidth="2" />
        <circle cx="25" cy="35" r="6" fill="none" stroke="#ffdc6e" strokeWidth="2" />
        <line x1="25" y1="35" x2="25" y2="45" stroke="#ffdc6e" strokeWidth="2" />
      </g>
    </svg>
  );
}
