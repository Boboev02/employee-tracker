const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

// ─── 1. Update tailwind.config to enable dark mode ───────────
let tailwind = fs.readFileSync('tailwind.config.ts', 'utf8');
if (!tailwind.includes('darkMode')) {
  tailwind = tailwind.replace(
    'const config: Config = {',
    `const config: Config = {\n  darkMode: 'class',`
  );
  fs.writeFileSync('tailwind.config.ts', tailwind);
  console.log('✓ tailwind.config.ts updated');
}

// ─── 2. Theme provider ───────────────────────────────────────
write('lib/useTheme.ts', `'use client';
import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const initial = stored ?? preferred;
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('theme', next);
    applyTheme(next);
  };

  return { theme, toggle };
}

function applyTheme(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}
`);

// ─── 3. Theme toggle button component ────────────────────────
write('components/ThemeToggle.tsx', `'use client';
import { useTheme } from '@/lib/useTheme';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button onClick={toggle}
      title={theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors">
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
`);

// ─── 4. Update globals.css for dark mode ─────────────────────
let globals = fs.readFileSync('app/globals.css', 'utf8');
if (!globals.includes('dark:bg-gray-900')) {
  globals += `

/* Dark mode base */
.dark body {
  background-color: #111827;
  color: #f9fafb;
}
.dark .bg-white { background-color: #1f2937 !important; }
.dark .bg-gray-50 { background-color: #111827 !important; }
.dark .bg-gray-100 { background-color: #374151 !important; }
.dark .border-gray-100,
.dark .border-gray-200 { border-color: #374151 !important; }
.dark .text-gray-900 { color: #f9fafb !important; }
.dark .text-gray-700 { color: #d1d5db !important; }
.dark .text-gray-600 { color: #9ca3af !important; }
.dark .text-gray-500 { color: #6b7280 !important; }
.dark .text-gray-400 { color: #4b5563 !important; }
.dark .hover\\:bg-gray-50:hover { background-color: #1f2937 !important; }
.dark .hover\\:bg-gray-100:hover { background-color: #374151 !important; }
.dark input, .dark select, .dark textarea {
  background-color: #374151 !important;
  border-color: #4b5563 !important;
  color: #f9fafb !important;
}
.dark input::placeholder, .dark textarea::placeholder { color: #6b7280 !important; }
.dark .bg-indigo-50 { background-color: #1e1b4b !important; }
.dark .bg-green-50 { background-color: #052e16 !important; }
.dark .bg-red-50 { background-color: #450a0a !important; }
.dark .bg-yellow-50 { background-color: #422006 !important; }
.dark .bg-blue-50 { background-color: #0c1a4b !important; }
.dark .sticky { background-color: #1f2937 !important; }
`;
  fs.writeFileSync('app/globals.css', globals);
  console.log('✓ globals.css updated');
}

// ─── 5. Add ThemeToggle to Sidebar ───────────────────────────
let sidebar = fs.readFileSync('components/layouts/Sidebar.tsx', 'utf8');
if (!sidebar.includes('ThemeToggle')) {
  sidebar = sidebar.replace(
    `import { useSocket } from '@/lib/useSocket';`,
    `import { useSocket } from '@/lib/useSocket';
import { ThemeToggle } from '@/components/ThemeToggle';`
  );
  // Add toggle in header next to logo
  sidebar = sidebar.replace(
    `        <span className="font-bold text-gray-900 text-sm">Employee Tracker</span>
      </div>`,
    `        <span className="font-bold text-gray-900 text-sm">Employee Tracker</span>
        <ThemeToggle />
      </div>`
  );
  fs.writeFileSync('components/layouts/Sidebar.tsx', sidebar);
  console.log('✓ sidebar updated with ThemeToggle');
}

// ─── 6. Add theme init script to layout to prevent flash ─────
let layout = fs.readFileSync('app/layout.tsx', 'utf8');
if (!layout.includes('theme-init')) {
  layout = layout.replace(
    '<body',
    `<script id="theme-init" dangerouslySetInnerHTML={{ __html: \`
        (function() {
          var theme = localStorage.getItem('theme');
          var preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          if ((theme || preferred) === 'dark') document.documentElement.classList.add('dark');
        })();
      \` }} />
      <body`
  );
  fs.writeFileSync('app/layout.tsx', layout);
  console.log('✓ layout.tsx updated with theme init');
}

console.log('\n✅ Dark mode setup complete');
