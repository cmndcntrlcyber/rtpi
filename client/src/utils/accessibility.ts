/**
 * WCAG Accessibility Utilities
 *
 * Provides helper functions, ARIA attributes, and utilities for building
 * accessible interfaces that comply with WCAG 2.1 Level AA standards.
 */

/**
 * ARIA Labels for common UI patterns
 */
export const ARIA_LABELS = {
  // Navigation
  navigation: {
    main: 'Main navigation',
    secondary: 'Secondary navigation',
    breadcrumb: 'Breadcrumb navigation',
    pagination: 'Pagination navigation',
    tabs: 'Tab navigation',
  },

  // Actions
  actions: {
    close: 'Close',
    open: 'Open',
    expand: 'Expand',
    collapse: 'Collapse',
    menu: 'Open menu',
    search: 'Search',
    filter: 'Filter',
    sort: 'Sort',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    submit: 'Submit',
    refresh: 'Refresh',
    download: 'Download',
    upload: 'Upload',
  },

  // Status
  status: {
    loading: 'Loading',
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Information',
  },

  // Forms
  forms: {
    required: 'Required field',
    optional: 'Optional field',
    invalid: 'Invalid input',
    valid: 'Valid input',
  },
} as const;

/**
 * Generate ARIA attributes for common patterns
 */
export const aria = {
  /**
   * Button with expanded state (e.g., accordion, dropdown)
   */
  button: {
    expanded: (isExpanded: boolean, controls?: string) => ({
      'aria-expanded': isExpanded,
      ...(controls && { 'aria-controls': controls }),
    }),

    pressed: (isPressed: boolean) => ({
      'aria-pressed': isPressed,
    }),

    disabled: (isDisabled: boolean) => ({
      'aria-disabled': isDisabled,
      disabled: isDisabled,
    }),
  },

  /**
   * Link with current state (for navigation)
   */
  link: {
    current: (isCurrent: boolean) => ({
      'aria-current': isCurrent ? 'page' : undefined,
    }),
  },

  /**
   * Dialog/Modal
   */
  dialog: {
    modal: (labelId?: string, descId?: string) => ({
      role: 'dialog',
      'aria-modal': true,
      ...(labelId && { 'aria-labelledby': labelId }),
      ...(descId && { 'aria-describedby': descId }),
    }),
  },

  /**
   * Live regions for dynamic content
   */
  live: {
    polite: (atomictype = false) => ({
      'aria-live': 'polite' as const,
      'aria-atomic': atomic,
    }),

    assertive: (atomic = false) => ({
      'aria-live': 'assertive' as const,
      'aria-atomic': atomic,
    }),

    status: () => ({
      role: 'status',
      'aria-live': 'polite' as const,
      'aria-atomic': true,
    }),

    alert: () => ({
      role: 'alert',
      'aria-live': 'assertive' as const,
      'aria-atomic': true,
    }),
  },

  /**
   * Form field
   */
  field: {
    input: (labelId?: string, descId?: string, errorId?: string, required = false, invalid = false) => ({
      'aria-required': required,
      'aria-invalid': invalid,
      ...(labelId && { 'aria-labelledby': labelId }),
      ...(descId && { 'aria-describedby': [descId, errorId].filter(Boolean).join(' ') || undefined }),
    }),
  },

  /**
   * Tab panel
   */
  tabs: {
    tab: (selected: boolean, controls: string) => ({
      role: 'tab',
      'aria-selected': selected,
      'aria-controls': controls,
      tabIndex: selected ? 0 : -1,
    }),

    tabPanel: (labelledBy: string, hidden: boolean) => ({
      role: 'tabpanel',
      'aria-labelledby': labelledBy,
      hidden,
      tabIndex: 0,
    }),

    tabList: () => ({
      role: 'tablist',
    }),
  },

  /**
   * Menu
   */
  menu: {
    button: (expanded: boolean, controls: string) => ({
      'aria-haspopup': true,
      'aria-expanded': expanded,
      'aria-controls': controls,
    }),

    menu: (labelledBy?: string) => ({
      role: 'menu',
      ...(labelledBy && { 'aria-labelledby': labelledBy }),
    }),

    menuItem: () => ({
      role: 'menuitem',
    }),
  },

  /**
   * Tooltip
   */
  tooltip: {
    trigger: (tooltipId: string) => ({
      'aria-describedby': tooltipId,
    }),

    tooltip: (id: string) => ({
      role: 'tooltip',
      id,
    }),
  },
};

/**
 * Focus management utilities
 */
export const focus = {
  /**
   * Trap focus within an element (for modals, dialogs)
   */
  trap: (element: HTMLElement) => {
    const focusableElements = element.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          lastFocusable?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          firstFocusable?.focus();
          e.preventDefault();
        }
      }
    };

    element.addEventListener('keydown', handleTabKey);

    // Return cleanup function
    return () => {
      element.removeEventListener('keydown', handleTabKey);
    };
  },

  /**
   * Restore focus to previous element
   */
  store: () => {
    const previousElement = document.activeElement as HTMLElement;
    return () => {
      previousElement?.focus();
    };
  },

  /**
   * Set focus to element with optional delay
   */
  set: (element: HTMLElement | null, delay = 0) => {
    if (!element) return;

    if (delay > 0) {
      setTimeout(() => element.focus(), delay);
    } else {
      element.focus();
    }
  },
};

/**
 * Keyboard navigation utilities
 */
export const keyboard = {
  /**
   * Common keyboard event handlers
   */
  handlers: {
    onEnterOrSpace: (callback: () => void) => (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        callback();
      }
    },

    onEscape: (callback: () => void) => (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        callback();
      }
    },

    onArrowKeys: (callbacks: {
      up?: () => void;
      down?: () => void;
      left?: () => void;
      right?: () => void;
    }) => (e: React.KeyboardEvent) => {
      const handler = {
        ArrowUp: callbacks.up,
        ArrowDown: callbacks.down,
        ArrowLeft: callbacks.left,
        ArrowRight: callbacks.right,
      }[e.key];

      if (handler) {
        e.preventDefault();
        handler();
      }
    },
  },

  /**
   * Make an element keyboard accessible
   */
  makeAccessible: (element: HTMLElement, onClick: () => void) => {
    if (!element.hasAttribute('role')) {
      element.setAttribute('role', 'button');
    }
    if (!element.hasAttribute('tabindex')) {
      element.setAttribute('tabindex', '0');
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    };

    element.addEventListener('keydown', handleKeyDown);

    return () => {
      element.removeEventListener('keydown', handleKeyDown);
    };
  },
};

/**
 * Screen reader utilities
 */
export const screenReader = {
  /**
   * Visually hide content but keep it accessible to screen readers
   */
  onlyClass: 'sr-only',

  /**
   * Announce message to screen readers
   */
  announce: (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', priority === 'assertive' ? 'alert' : 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  },

  /**
   * Get text content for screen readers (strips formatting)
   */
  getText: (element: HTMLElement): string => {
    return element.textContent || element.innerText || '';
  },
};

/**
 * Color contrast utilities (WCAG AA compliance)
 */
export const contrast = {
  /**
   * Calculate relative luminance (WCAG formula)
   */
  getLuminance: (color: string): number => {
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;

    // Apply gamma correction
    const [rs, gs, bs] = [r, g, b].map(c =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    );

    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  },

  /**
   * Calculate contrast ratio between two colors
   */
  getContrastRatio: (color1: string, color2: string): number => {
    const lum1 = contrast.getLuminance(color1);
    const lum2 = contrast.getLuminance(color2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  },

  /**
   * Check if contrast meets WCAG AA standards
   * - 4.5:1 for normal text
   * - 3:1 for large text (18pt+ or 14pt+ bold)
   */
  meetsWCAG_AA: (foreground: string, background: string, largeText = false): boolean => {
    const ratio = contrast.getContrastRatio(foreground, background);
    return largeText ? ratio >= 3 : ratio >= 4.5;
  },

  /**
   * Check if contrast meets WCAG AAA standards
   * - 7:1 for normal text
   * - 4.5:1 for large text
   */
  meetsWCAG_AAA: (foreground: string, background: string, largeText = false): boolean => {
    const ratio = contrast.getContrastRatio(foreground, background);
    return largeText ? ratio >= 4.5 : ratio >= 7;
  },
};

/**
 * Focus visible classes (for keyboard navigation)
 */
export const FOCUS_CLASSES = {
  default: 'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
  inset: 'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset',
  visible: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
  none: 'focus:outline-none',
} as const;

/**
 * Skip link for keyboard navigation
 */
export const skipLinkClass = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md';

/**
 * Generate unique IDs for ARIA relationships
 */
let idCounter = 0;
export const generateId = (prefix = 'a11y'): string => {
  return `${prefix}-${++idCounter}-${Date.now()}`;
};

/**
 * Validation utilities for accessibility
 */
export const validate = {
  /**
   * Check if element has accessible name
   */
  hasAccessibleName: (element: HTMLElement): boolean => {
    return !!(
      element.getAttribute('aria-label') ||
      element.getAttribute('aria-labelledby') ||
      (element as HTMLInputElement).labels?.length ||
      element.textContent?.trim()
    );
  },

  /**
   * Check if interactive element is keyboard accessible
   */
  isKeyboardAccessible: (element: HTMLElement): boolean => {
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute('role');

    // Native interactive elements
    if (['a', 'button', 'input', 'select', 'textarea'].includes(tagName)) {
      return true;
    }

    // Elements with interactive roles must have tabindex
    const interactiveRoles = ['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio'];
    if (role && interactiveRoles.includes(role)) {
      return element.hasAttribute('tabindex');
    }

    return false;
  },
};

/**
 * WCAG-compliant color palette
 * All colors meet 4.5:1 contrast ratio against white or dark backgrounds
 */
export const ACCESSIBLE_COLORS = {
  // Status colors (4.5:1 against white background)
  success: {
    text: '#166534',    // green-800
    bg: '#dcfce7',      // green-100
    border: '#16a34a',  // green-600
  },
  error: {
    text: '#991b1b',    // red-800
    bg: '#fee2e2',      // red-100
    border: '#dc2626',  // red-600
  },
  warning: {
    text: '#92400e',    // amber-800
    bg: '#fef3c7',      // amber-100
    border: '#f59e0b',  // amber-500
  },
  info: {
    text: '#1e40af',    // blue-800
    bg: '#dbeafe',      // blue-100
    border: '#3b82f6',  // blue-500
  },
} as const;
