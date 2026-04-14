import type { Metadata, Viewport } from 'next';
import './globals.css';
import NavHeader from './NavHeader';

export const metadata: Metadata = {
  title: 'L\'Ordinaire',
  description: 'Le repas du personnel, on s\'en occupe.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#C8402A',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen">
        <NavHeader />
        {children}
      </body>
    </html>
  );
}
