import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../lib/auth';
import { Navigation } from '../components/Navigation';
import { BrandingInitializer } from '../components/BrandingInitializer';

export const metadata: Metadata = {
  title: 'NeuronX Operator Control Plane',
  description: 'Authoritative control plane for NeuronX sales operating system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en'>
      <body className='bg-gray-50 min-h-screen'>
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
