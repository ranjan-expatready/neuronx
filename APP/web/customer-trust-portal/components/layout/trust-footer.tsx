export function TrustFooter() {
  return (
    <footer className='bg-white border-t border-gray-200 mt-auto'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
        <div className='flex flex-col md:flex-row justify-between items-center'>
          <div className='flex items-center space-x-4 text-sm text-gray-500'>
            <span>© 2026 NeuronX. All rights reserved.</span>
            <span>•</span>
            <span>Enterprise Trust & Compliance Portal</span>
          </div>

          <div className='flex items-center space-x-6 mt-4 md:mt-0'>
            <div className='flex items-center space-x-2 text-xs text-gray-400'>
              <div className='w-2 h-2 bg-green-400 rounded-full animate-pulse'></div>
              <span>System Operational</span>
            </div>

            <div className='text-xs text-gray-400'>
              Last updated: {new Date().toLocaleString()}
            </div>
          </div>
        </div>

        <div className='mt-4 pt-4 border-t border-gray-100'>
          <div className='flex flex-wrap justify-center space-x-6 text-xs text-gray-400'>
            <span>🔒 SOC 2 Type II Compliant</span>
            <span>🔐 End-to-end Encrypted</span>
            <span>📊 Real-time Audit Trail</span>
            <span>🛡️ Zero-trust Architecture</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
