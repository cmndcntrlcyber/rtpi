/**
 * Mobile Responsive Utilities
 *
 * Provides helper functions and class utilities for building
 * responsive interfaces with mobile-first design principles.
 */

/**
 * Touch target minimum sizes (WCAG 2.5.5)
 * Mobile: 44x44px (iOS HIG), 48x48dp (Material Design)
 */
export const TOUCH_TARGET = {
  mobile: 'min-h-[44px] min-w-[44px]',
  tablet: 'md:min-h-[40px] md:min-w-[40px]',
  desktop: 'lg:min-h-[36px] lg:min-w-[36px]',
} as const;

/**
 * Responsive spacing classes
 * Automatically adjust padding/margin based on screen size
 */
export const RESPONSIVE_SPACING = {
  // Padding
  padding: {
    xs: 'p-2 sm:p-3 md:p-4 lg:p-6',
    sm: 'p-3 sm:p-4 md:p-6 lg:p-8',
    md: 'p-4 sm:p-6 md:p-8 lg:p-10',
    lg: 'p-6 sm:p-8 md:p-10 lg:p-12',
  },
  paddingX: {
    xs: 'px-2 sm:px-3 md:px-4 lg:px-6',
    sm: 'px-3 sm:px-4 md:px-6 lg:px-8',
    md: 'px-4 sm:px-6 md:px-8 lg:px-10',
    lg: 'px-6 sm:px-8 md:px-10 lg:px-12',
  },
  paddingY: {
    xs: 'py-2 sm:py-3 md:py-4 lg:py-6',
    sm: 'py-3 sm:py-4 md:py-6 lg:py-8',
    md: 'py-4 sm:py-6 md:py-8 lg:py-10',
    lg: 'py-6 sm:py-8 md:py-10 lg:py-12',
  },
  // Margin
  margin: {
    xs: 'm-2 sm:m-3 md:m-4 lg:m-6',
    sm: 'm-3 sm:m-4 md:m-6 lg:m-8',
    md: 'm-4 sm:m-6 md:m-8 lg:m-10',
    lg: 'm-6 sm:m-8 md:m-10 lg:m-12',
  },
  // Gap (for flex/grid)
  gap: {
    xs: 'gap-2 sm:gap-3 md:gap-4',
    sm: 'gap-3 sm:gap-4 md:gap-6',
    md: 'gap-4 sm:gap-6 md:gap-8',
    lg: 'gap-6 sm:gap-8 md:gap-10',
  },
} as const;

/**
 * Responsive text sizes
 */
export const RESPONSIVE_TEXT = {
  heading: {
    h1: 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl',
    h2: 'text-xl sm:text-2xl md:text-3xl lg:text-4xl',
    h3: 'text-lg sm:text-xl md:text-2xl lg:text-3xl',
    h4: 'text-base sm:text-lg md:text-xl lg:text-2xl',
  },
  body: {
    lg: 'text-base sm:text-lg md:text-xl',
    md: 'text-sm sm:text-base md:text-lg',
    sm: 'text-xs sm:text-sm md:text-base',
  },
} as const;

/**
 * Responsive grid columns
 */
export const RESPONSIVE_GRID = {
  auto: 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  cards: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  halves: 'grid grid-cols-1 md:grid-cols-2',
  thirds: 'grid grid-cols-1 md:grid-cols-3',
  quarters: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  dashboard: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
} as const;

/**
 * Mobile-optimized button classes
 * Ensures buttons are touch-friendly on mobile devices
 */
export const mobileButtonClasses = (variant: 'primary' | 'secondary' | 'ghost' = 'primary') => {
  const base = 'min-h-[44px] px-4 md:min-h-[36px] md:px-3 transition-colors';

  switch (variant) {
    case 'primary':
      return `${base} active:scale-95 touch-manipulation`;
    case 'secondary':
      return `${base} active:scale-95 touch-manipulation`;
    case 'ghost':
      return `${base} active:bg-muted touch-manipulation`;
    default:
      return base;
  }
};

/**
 * Mobile-optimized input classes
 */
export const mobileInputClasses = () => {
  return 'min-h-[44px] text-base md:text-sm px-4 md:px-3';
};

/**
 * Detect if device is mobile
 * Note: This runs client-side only
 */
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) || window.innerWidth < 768;
};

/**
 * Detect if device supports touch
 */
export const isTouchDevice = (): boolean => {
  if (typeof window === 'undefined') return false;

  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-ignore - for IE11
    navigator.msMaxTouchPoints > 0
  );
};

/**
 * Get responsive breakpoint value
 */
export const getBreakpoint = (): 'mobile' | 'tablet' | 'desktop' | 'wide' => {
  if (typeof window === 'undefined') return 'desktop';

  const width = window.innerWidth;

  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  if (width < 1536) return 'desktop';
  return 'wide';
};

/**
 * Mobile-friendly dialog/modal classes
 */
export const mobileDialogClasses = {
  content: 'max-h-[90vh] w-[95vw] sm:w-full overflow-y-auto',
  header: 'sticky top-0 bg-background z-10 border-b pb-4',
  body: 'py-4',
  footer: 'sticky bottom-0 bg-background z-10 border-t pt-4',
};

/**
 * Stack items vertically on mobile, horizontally on desktop
 */
export const responsiveStack = (reverse: boolean = false) => {
  return reverse
    ? 'flex flex-col-reverse md:flex-row'
    : 'flex flex-col md:flex-row';
};

/**
 * Hide on mobile, show on desktop
 */
export const hideOnMobile = 'hidden md:block';

/**
 * Show on mobile only
 */
export const showOnMobileOnly = 'block md:hidden';

/**
 * Responsive container widths
 */
export const CONTAINER_WIDTHS = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
  full: 'max-w-full',
} as const;

/**
 * Generate responsive classes for custom values
 */
export const responsive = {
  /**
   * Create responsive size classes
   * Example: responsive.size('w', { mobile: 'full', tablet: '1/2', desktop: '1/3' })
   * Returns: 'w-full md:w-1/2 lg:w-1/3'
   */
  size: (
    property: string,
    sizes: {
      mobile?: string;
      tablet?: string;
      desktop?: string;
      wide?: string;
    }
  ): string => {
    const classes: string[] = [];

    if (sizes.mobile) classes.push(`${property}-${sizes.mobile}`);
    if (sizes.tablet) classes.push(`md:${property}-${sizes.tablet}`);
    if (sizes.desktop) classes.push(`lg:${property}-${sizes.desktop}`);
    if (sizes.wide) classes.push(`xl:${property}-${sizes.wide}`);

    return classes.join(' ');
  },

  /**
   * Create responsive display classes
   */
  display: (displays: {
    mobile?: string;
    tablet?: string;
    desktop?: string;
  }): string => {
    const classes: string[] = [];

    if (displays.mobile) classes.push(displays.mobile);
    if (displays.tablet) classes.push(`md:${displays.tablet}`);
    if (displays.desktop) classes.push(`lg:${displays.desktop}`);

    return classes.join(' ');
  },
};

/**
 * Format viewport-relative values
 * Useful for responsive sizing calculations
 */
export const viewport = {
  width: (percentage: number) => `${percentage}vw`,
  height: (percentage: number) => `${percentage}vh`,
  min: (percentage: number) => `${percentage}vmin`,
  max: (percentage: number) => `${percentage}vmax`,
};

/**
 * Media query hooks (for use in React components)
 * Usage: const isMobile = useMediaQuery('(max-width: 768px)');
 */
export const MEDIA_QUERIES = {
  mobile: '(max-width: 640px)',
  tablet: '(min-width: 641px) and (max-width: 1024px)',
  desktop: '(min-width: 1025px)',
  touchDevice: '(hover: none) and (pointer: coarse)',
  prefersDark: '(prefers-color-scheme: dark)',
  prefersLight: '(prefers-color-scheme: light)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
} as const;
