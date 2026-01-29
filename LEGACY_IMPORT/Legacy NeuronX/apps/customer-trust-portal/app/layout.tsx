import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/lib/query-provider';
import { TrustHeader } from '@/components/layout/trust-header';
import { TrustFooter } from '@/components/layout/trust-footer';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'NeuronX Trust Portal',
  description: 'Transparent audit and compliance portal for NeuronX operations',
  keywords: ['neuronx', 'audit', 'compliance', 'trust', 'transparency'],
  authors: [{ name: 'NeuronX Team' }],
  viewport: 'width=device-width, initial-scale=1',
  robots: 'noindex, nofollow', // Internal portal only
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en' className='h-full'>
      <body className={`${inter.className} h-full bg-gray-50`}>
        <QueryProvider>
          <div className='min-h-full flex flex-col'>
            <TrustHeader />
            <main className='flex-1'>{children}</main>
            <TrustFooter />
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
