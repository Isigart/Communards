'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Accueil' },
  { href: '/planning', label: 'Planning' },
  { href: '/briefing', label: 'Briefing' },
  { href: '/reglages', label: 'Reglages' },
];

const HIDDEN_ON = ['/', '/onboarding', '/demo', '/enquete'];

export default function NavHeader() {
  const pathname = usePathname();

  // Hide on login, onboarding, demo, enquete, and brief pages
  if (HIDDEN_ON.includes(pathname) || pathname.startsWith('/brief/')) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-lg mx-auto px-4 flex items-center justify-between h-12">
        <Link href="/dashboard" className="text-sm font-bold text-brand-600">
          La Table de l&apos;Equipe
        </Link>
        <nav className="flex gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === item.href
                  ? 'bg-brand-50 text-brand-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
