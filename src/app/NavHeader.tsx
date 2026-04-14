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

  if (HIDDEN_ON.includes(pathname) || pathname.startsWith('/brief/')) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 bg-papier border-b border-bordure">
      <div className="max-w-lg mx-auto px-4 flex items-center justify-between h-12">
        <Link href="/dashboard" className="font-titre text-sm font-bold text-noir">
          L&apos;Ordinaire
        </Link>
        <nav className="flex gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                pathname === item.href
                  ? 'bg-noir/5 text-noir font-medium'
                  : 'text-muted hover:text-noir'
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
