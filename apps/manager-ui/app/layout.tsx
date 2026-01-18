import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../lib/auth';
import { Navigation } from '../components/Navigation';
import { BrandingInitializer } from '../components/BrandingInitializer';

export const metadata: Metadata = {
  title: 'NeuronX Manager Console',
  description: 'Team Intelligence & Coaching Surface for NeuronX',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en'>
      <body className='manager-console'>
        <AuthProvider>
          <BrandingInitializer />
          <Navigation />
          <main className='max-w-7xl mx-auto py-6 sm:px-6 lg:px-8'>
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
