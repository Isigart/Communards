import type { Metadata, Viewport } from 'next';
import './globals.css';
import NavHeader from './NavHeader';

export const metadata: Metadata = {
  title: 'La Table de l\'Equipe',
  description: 'Le repas du personnel, organise.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#e99a0d',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen pt-0">
        <NavHeader />
        {children}
      </body>
    </html>
  );
}
