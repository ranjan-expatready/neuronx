/**
 * Design Tokens - WI-069: Branding Kit + UI Beautification
 *
 * Core design tokens using CSS variables for runtime theming.
 * These tokens are applied globally via CSS custom properties.
 */

export interface DesignTokens {
  // Color Palette
  colors: {
    primary: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
    };
    secondary: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
    };
    neutral: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
    };
    // Performance bands with accessible contrast
    band: {
      green: string;
      yellow: string;
      red: string;
      unknown: string;
    };
  };

  // Typography
  typography: {
    fontFamily: string;
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
      '4xl': string;
    };
    fontWeight: {
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
    };
    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
    };
  };

  // Spacing
  spacing: {
    0: string;
    1: string;
    2: string;
    3: string;
    4: string;
    5: string;
    6: string;
    8: string;
    10: string;
    12: string;
    16: string;
    20: string;
    24: string;
    32: string;
    40: string;
    48: string;
    56: string;
    64: string;
  };

  // Border Radius
  borderRadius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    full: string;
  };

  // Shadows
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    inner: string;
  };

  // Z-Index
  zIndex: {
    dropdown: number;
    sticky: number;
    fixed: number;
    modal: number;
    popover: number;
    tooltip: number;
  };
}

/**
 * Default design tokens - NeuronX enterprise theme
 */
export const defaultTokens: DesignTokens = {
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
    secondary: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
    neutral: {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#e5e5e5',
      300: '#d4d4d4',
      400: '#a3a3a3',
      500: '#737373',
      600: '#525252',
      700: '#404040',
      800: '#262626',
      900: '#171717',
    },
    band: {
      green: '#10b981', // Emerald-500 - meets WCAG AA contrast
      yellow: '#f59e0b', // Amber-500 - meets WCAG AA contrast
      red: '#ef4444', // Red-500 - meets WCAG AA contrast
      unknown: '#6b7280', // Gray-500 - neutral state
    },
  },

  typography: {
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.625,
    },
  },

  spacing: {
    0: '0px',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
    32: '8rem',
    40: '10rem',
    48: '12rem',
    56: '14rem',
    64: '16rem',
  },

  borderRadius: {
    none: '0px',
    sm: '0.125rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    full: '9999px',
  },

  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  },

  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
  },
};

/**
 * Generate CSS custom properties from design tokens
 */
export function generateCssVariables(tokens: DesignTokens): string {
  const cssVars: string[] = [];

  // Colors
  Object.entries(tokens.colors.primary).forEach(([key, value]) => {
    cssVars.push(`  --color-primary-${key}: ${value};`);
  });

  Object.entries(tokens.colors.secondary).forEach(([key, value]) => {
    cssVars.push(`  --color-secondary-${key}: ${value};`);
  });

  Object.entries(tokens.colors.neutral).forEach(([key, value]) => {
    cssVars.push(`  --color-neutral-${key}: ${value};`);
  });

  Object.entries(tokens.colors.band).forEach(([key, value]) => {
    cssVars.push(`  --color-band-${key}: ${value};`);
  });

  // Typography
  cssVars.push(`  --font-family: ${tokens.typography.fontFamily};`);

  Object.entries(tokens.typography.fontSize).forEach(([key, value]) => {
    cssVars.push(`  --font-size-${key}: ${value};`);
  });

  Object.entries(tokens.typography.fontWeight).forEach(([key, value]) => {
    cssVars.push(`  --font-weight-${key}: ${value};`);
  });

  Object.entries(tokens.typography.lineHeight).forEach(([key, value]) => {
    cssVars.push(`  --line-height-${key}: ${value};`);
  });

  // Spacing
  Object.entries(tokens.spacing).forEach(([key, value]) => {
    cssVars.push(`  --spacing-${key}: ${value};`);
  });

  // Border Radius
  Object.entries(tokens.borderRadius).forEach(([key, value]) => {
    cssVars.push(`  --border-radius-${key}: ${value};`);
  });

  // Shadows
  Object.entries(tokens.shadows).forEach(([key, value]) => {
    cssVars.push(`  --shadow-${key}: ${value};`);
  });

  // Z-Index
  Object.entries(tokens.zIndex).forEach(([key, value]) => {
    cssVars.push(`  --z-index-${key}: ${value};`);
  });

  return `:root {\n${cssVars.join('\n')}\n}`;
}

/**
 * Apply design tokens to document root
 */
export function applyTokens(tokens: DesignTokens): void {
  if (typeof document === 'undefined') return;

  const css = generateCssVariables(tokens);
  const styleId = 'neuronx-design-tokens';

  // Remove existing style element
  const existingStyle = document.getElementById(styleId);
  if (existingStyle) {
    existingStyle.remove();
  }

  // Add new style element
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = css;
  document.head.appendChild(style);
}
