import { useState, useEffect } from 'react';

/**
 * useMediaQuery Hook
 *
 * Listen to CSS media query changes and reactively update component state.
 *
 * @param query - CSS media query string (e.g., "(max-width: 768px)")
 * @returns boolean indicating if the media query matches
 *
 * @example
 * ```tsx
 * const isMobile = useMediaQuery('(max-width: 768px)');
 * const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
 * const isTouchDevice = useMediaQuery('(hover: none) and (pointer: coarse)');
 *
 * return (
 *   <div>
 *     {isMobile ? <MobileLayout /> : <DesktopLayout />}
 *   </div>
 * );
 * ```
 */
export function useMediaQuery(query: string): boolean {
  // Initialize state with undefined to handle SSR
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    // Return early if window is not available (SSR)
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);

    // Update state when query changes
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Set initial value
    setMatches(mediaQuery.matches);

    // Add event listener (modern browsers)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }

    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [query]);

  return matches;
}

/**
 * useBreakpoint Hook
 *
 * Get the current responsive breakpoint.
 *
 * @returns Object with boolean flags for each breakpoint
 *
 * @example
 * ```tsx
 * const { isMobile, isTablet, isDesktop, isWide } = useBreakpoint();
 *
 * return (
 *   <div>
 *     {isMobile && <p>Mobile view</p>}
 *     {isDesktop && <p>Desktop view</p>}
 *   </div>
 * );
 * ```
 */
export function useBreakpoint() {
  const isMobile = useMediaQuery('(max-width: 640px)');
  const isTablet = useMediaQuery('(min-width: 641px) and (max-width: 1024px)');
  const isDesktop = useMediaQuery('(min-width: 1025px)');
  const isWide = useMediaQuery('(min-width: 1536px)');

  // Computed flags for common use cases
  const isMobileOrTablet = isMobile || isTablet;
  const isDesktopOrWide = isDesktop || isWide;

  return {
    isMobile,
    isTablet,
    isDesktop,
    isWide,
    isMobileOrTablet,
    isDesktopOrWide,
    // Current breakpoint name
    current: isMobile ? 'mobile' : isTablet ? 'tablet' : isDesktop ? 'desktop' : 'wide',
  } as const;
}

/**
 * useIsTouchDevice Hook
 *
 * Detect if the device supports touch input.
 *
 * @returns boolean indicating if touch is supported
 *
 * @example
 * ```tsx
 * const isTouch = useIsTouchDevice();
 *
 * return (
 *   <button className={isTouch ? 'min-h-[44px]' : 'min-h-[36px]'}>
 *     Click me
 *   </button>
 * );
 * ```
 */
export function useIsTouchDevice(): boolean {
  const supportsTouch = useMediaQuery('(hover: none) and (pointer: coarse)');
  return supportsTouch;
}

/**
 * useViewportSize Hook
 *
 * Get the current viewport width and height with reactive updates.
 *
 * @returns Object with width and height in pixels
 *
 * @example
 * ```tsx
 * const { width, height } = useViewportSize();
 *
 * return (
 *   <div>
 *     Viewport: {width}x{height}
 *   </div>
 * );
 * ```
 */
export function useViewportSize() {
  const [size, setSize] = useState<{ width: number; height: number }>(() => {
    if (typeof window === 'undefined') {
      return { width: 1024, height: 768 }; // Default for SSR
    }
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}

/**
 * useOrientation Hook
 *
 * Detect device orientation (portrait or landscape).
 *
 * @returns 'portrait' or 'landscape'
 *
 * @example
 * ```tsx
 * const orientation = useOrientation();
 *
 * return (
 *   <div className={orientation === 'portrait' ? 'flex-col' : 'flex-row'}>
 *     Content
 *   </div>
 * );
 * ```
 */
export function useOrientation(): 'portrait' | 'landscape' {
  const isPortrait = useMediaQuery('(orientation: portrait)');
  return isPortrait ? 'portrait' : 'landscape';
}

/**
 * usePrefersReducedMotion Hook
 *
 * Detect if user prefers reduced motion (accessibility setting).
 *
 * @returns boolean indicating if reduced motion is preferred
 *
 * @example
 * ```tsx
 * const prefersReducedMotion = usePrefersReducedMotion();
 *
 * return (
 *   <div className={prefersReducedMotion ? '' : 'animate-fade-in'}>
 *     Content
 *   </div>
 * );
 * ```
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * usePrefersDarkMode Hook
 *
 * Detect if user prefers dark color scheme.
 *
 * @returns boolean indicating if dark mode is preferred
 *
 * @example
 * ```tsx
 * const prefersDark = usePrefersDarkMode();
 *
 * return (
 *   <div className={prefersDark ? 'dark' : 'light'}>
 *     Content
 *   </div>
 * );
 * ```
 */
export function usePrefersDarkMode(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}
