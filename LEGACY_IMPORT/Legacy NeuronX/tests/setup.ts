// Vitest setup file
import { vi } from 'vitest';

// Polyfill jest global for compatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, no-undef
(global as any).jest = vi;
