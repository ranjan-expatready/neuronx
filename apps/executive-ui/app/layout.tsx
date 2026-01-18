import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../lib/auth';
import { Navigation } from '../components/Navigation';
import { BrandingInitializer } from '../components/BrandingInitializer';

export const metadata: Metadata = {
  title: 'NeuronX Executive Dashboard',
  description: 'Business Confidence Surface for Executive Decision Making',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en'>
      <body className='executive-dashboard'>
        <AuthProvider>
          <BrandingInitializer />
          <Navigation />
          <main className='max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8'>
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
