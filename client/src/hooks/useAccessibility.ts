import { useEffect, useRef, useState, useCallback } from 'react';
import { generateId, focus, keyboard } from '@/utils/accessibility';

/**
 * useAriaAnnounce Hook
 *
 * Programmatically announce messages to screen readers.
 *
 * @example
 * ```tsx
 * const announce = useAriaAnnounce();
 *
 * const handleSave = () => {
 *   saveData();
 *   announce('Data saved successfully', 'polite');
 * };
 * ```
 */
export function useAriaAnnounce() {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', priority === 'assertive' ? 'alert' : 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, []);

  return announce;
}

/**
 * useFocusTrap Hook
 *
 * Trap focus within a component (for modals, dialogs, etc.).
 *
 * @example
 * ```tsx
 * const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
 *
 * return (
 *   <div ref={dialogRef} role="dialog">
 *     {/* Content */}
 *   </div>
 * );
 * ```
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean = true) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active || !ref.current) return;

    const element = ref.current;
    const cleanup = focus.trap(element);

    // Focus first element when trap activates
    const focusableElements = element.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusableElements[0]?.focus();

    return cleanup;
  }, [active]);

  return ref;
}

/**
 * useFocusReturn Hook
 *
 * Store and restore focus when component unmounts or condition changes.
 *
 * @example
 * ```tsx
 * useFocusReturn(isDialogOpen);
 *
 * // When dialog closes, focus returns to previously focused element
 * ```
 */
export function useFocusReturn(active: boolean) {
  const restoreFocus = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (active) {
      restoreFocus.current = focus.store();
    } else if (restoreFocus.current) {
      restoreFocus.current();
      restoreFocus.current = null;
    }

    return () => {
      if (restoreFocus.current) {
        restoreFocus.current();
      }
    };
  }, [active]);
}

/**
 * useKeyboardShortcut Hook
 *
 * Register keyboard shortcuts with accessibility in mind.
 *
 * @example
 * ```tsx
 * useKeyboardShortcut('ctrl+s', () => {
 *   save();
 *   announce('Saved');
 * }, { preventDefault: true });
 * ```
 */
export function useKeyboardShortcut(
  shortcut: string,
  callback: () => void,
  options: { preventDefault?: boolean; enabled?: boolean } = {}
) {
  const { preventDefault = true, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const keys = shortcut.toLowerCase().split('+');
      const modifiers = {
        ctrl: e.ctrlKey || e.metaKey,
        alt: e.altKey,
        shift: e.shiftKey,
      };

      const keyMatches = keys.every(key => {
        if (key === 'ctrl') return modifiers.ctrl;
        if (key === 'alt') return modifiers.alt;
        if (key === 'shift') return modifiers.shift;
        return e.key.toLowerCase() === key;
      });

      if (keyMatches) {
        if (preventDefault) e.preventDefault();
        callback();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcut, callback, preventDefault, enabled]);
}

/**
 * useAriaId Hook
 *
 * Generate stable, unique IDs for ARIA relationships.
 *
 * @example
 * ```tsx
 * const labelId = useAriaId('label');
 * const descId = useAriaId('desc');
 *
 * return (
 *   <>
 *     <label id={labelId}>Name</label>
 *     <p id={descId}>Enter your full name</p>
 *     <input
 *       aria-labelledby={labelId}
 *       aria-describedby={descId}
 *     />
 *   </>
 * );
 * ```
 */
export function useAriaId(prefix = 'aria'): string {
  const [id] = useState(() => generateId(prefix));
  return id;
}

/**
 * useKeyboardNavigation Hook
 *
 * Handle keyboard navigation for lists, menus, etc.
 *
 * @example
 * ```tsx
 * const { activeIndex, handleKeyDown } = useKeyboardNavigation({
 *   items: menuItems,
 *   orientation: 'vertical',
 *   onSelect: (item) => handleSelect(item),
 * });
 * ```
 */
export function useKeyboardNavigation<T>({
  items,
  orientation = 'vertical',
  loop = true,
  onSelect,
}: {
  items: T[];
  orientation?: 'vertical' | 'horizontal';
  loop?: boolean;
  onSelect?: (item: T, index: number) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const isVertical = orientation === 'vertical';
      const nextKey = isVertical ? 'ArrowDown' : 'ArrowRight';
      const prevKey = isVertical ? 'ArrowUp' : 'ArrowLeft';

      let newIndex = activeIndex;

      switch (e.key) {
        case nextKey:
          e.preventDefault();
          newIndex = activeIndex + 1;
          if (newIndex >= items.length) {
            newIndex = loop ? 0 : items.length - 1;
          }
          setActiveIndex(newIndex);
          break;

        case prevKey:
          e.preventDefault();
          newIndex = activeIndex - 1;
          if (newIndex < 0) {
            newIndex = loop ? items.length - 1 : 0;
          }
          setActiveIndex(newIndex);
          break;

        case 'Home':
          e.preventDefault();
          setActiveIndex(0);
          break;

        case 'End':
          e.preventDefault();
          setActiveIndex(items.length - 1);
          break;

        case 'Enter':
        case ' ':
          e.preventDefault();
          if (onSelect) {
            onSelect(items[activeIndex], activeIndex);
          }
          break;

        default:
          break;
      }
    },
    [activeIndex, items, orientation, loop, onSelect]
  );

  return {
    activeIndex,
    setActiveIndex,
    handleKeyDown,
  };
}

/**
 * useAccessibleClick Hook
 *
 * Make non-interactive elements clickable with keyboard support.
 *
 * @example
 * ```tsx
 * const clickProps = useAccessibleClick(() => {
 *   console.log('Clicked!');
 * });
 *
 * return <div {...clickProps}>Click me</div>;
 * ```
 */
export function useAccessibleClick(
  onClick: () => void,
  options: { role?: string; disabled?: boolean } = {}
) {
  const { role = 'button', disabled = false } = options;

  const handleClick = useCallback(() => {
    if (!disabled) {
      onClick();
    }
  }, [onClick, disabled]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    },
    [onClick, disabled]
  );

  return {
    role,
    tabIndex: disabled ? -1 : 0,
    onClick: handleClick,
    onKeyDown: handleKeyDown,
    'aria-disabled': disabled,
  };
}

/**
 * useDisclosure Hook with Accessibility
 *
 * Manage disclosure widgets (accordions, dropdowns, etc.) with proper ARIA.
 *
 * @example
 * ```tsx
 * const { isOpen, toggle, buttonProps, panelProps } = useDisclosure();
 *
 * return (
 *   <>
 *     <button {...buttonProps}>Toggle</button>
 *     <div {...panelProps}>Content</div>
 *   </>
 * );
 * ```
 */
export function useDisclosure(defaultOpen = false) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const buttonId = useAriaId('disclosure-button');
  const panelId = useAriaId('disclosure-panel');

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const buttonProps = {
    id: buttonId,
    'aria-expanded': isOpen,
    'aria-controls': panelId,
    onClick: toggle,
  };

  const panelProps = {
    id: panelId,
    'aria-labelledby': buttonId,
    hidden: !isOpen,
  };

  return {
    isOpen,
    toggle,
    open,
    close,
    buttonProps,
    panelProps,
  };
}

/**
 * useSkipLink Hook
 *
 * Add skip link functionality for keyboard navigation.
 *
 * @example
 * ```tsx
 * const { skipLinkProps, targetRef } = useSkipLink();
 *
 * return (
 *   <>
 *     <a {...skipLinkProps}>Skip to main content</a>
 *     <main ref={targetRef}>Content</main>
 *   </>
 * );
 * ```
 */
export function useSkipLink() {
  const targetRef = useRef<HTMLElement>(null);
  const id = useAriaId('skip-target');

  const skipLinkProps = {
    href: `#${id}`,
    className: 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md',
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      targetRef.current?.focus();
      targetRef.current?.scrollIntoView({ behavior: 'smooth' });
    },
  };

  return {
    skipLinkProps,
    targetRef,
    targetProps: {
      ref: targetRef,
      id,
      tabIndex: -1,
    },
  };
}
