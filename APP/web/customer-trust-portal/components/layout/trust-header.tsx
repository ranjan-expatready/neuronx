'use client';

import { Shield, Eye, FileCheck } from 'lucide-react';
import Link from 'next/link';

export function TrustHeader() {
  return (
    <header className='bg-white shadow-sm border-b border-gray-200'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between items-center h-16'>
          <div className='flex items-center'>
            <div className='flex-shrink-0'>
              <Shield className='h-8 w-8 text-trust-600' />
            </div>
            <div className='ml-3'>
              <h1 className='text-xl font-bold text-gray-900'>
                NeuronX Trust Portal
              </h1>
              <p className='text-xs text-gray-500'>
                Enterprise Transparency & Compliance
              </p>
            </div>
          </div>

          <nav className='flex space-x-8'>
            <Link
              href='/'
              className='text-gray-900 hover:text-trust-600 px-3 py-2 text-sm font-medium transition-colors'
            >
              Dashboard
            </Link>
            <Link
              href='/audit'
              className='text-gray-500 hover:text-trust-600 px-3 py-2 text-sm font-medium transition-colors flex items-center'
            >
              <Eye className='h-4 w-4 mr-1' />
              Audit Log
            </Link>
            <Link
              href='/compliance'
              className='text-gray-500 hover:text-trust-600 px-3 py-2 text-sm font-medium transition-colors flex items-center'
            >
              <FileCheck className='h-4 w-4 mr-1' />
              Compliance
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
