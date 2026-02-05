# UI/UX Improvements - Tier 2 Priority

**Parent Document:** [FUTURE-ENHANCEMENTS.md](../FUTURE-ENHANCEMENTS.md)  
**Priority:** 🟡 Tier 2 - Beta Enhancement  
**Timeline:** Week 3-4 (Days 15-30)  
**Total Items:** 30  
**Last Updated:** December 4, 2025

---

## Overview

This document details UI/UX improvements to enhance usability, accessibility, and overall user experience during beta testing.

### Purpose
- **Improve navigation** with collapsible sidebar
- **Enhance visual design** with dark mode
- **Support mobile devices** with responsive layout
- **Increase productivity** with keyboard shortcuts
- **Streamline workflows** with bulk operations

### Success Criteria
- ✅ Collapsible sidebar functional
- ✅ Dark mode implemented
- ✅ Mobile responsive (tablet minimum)
- ✅ Keyboard shortcuts working
- ✅ Bulk operations available

---

## Table of Contents

1. [Collapsible Sidebar](#collapsible-sidebar)
2. [Dark Mode Support](#dark-mode-support)
3. [Mobile Responsive Design](#mobile-responsive-design)
4. [Keyboard Shortcuts](#keyboard-shortcuts)
5. [Advanced Search & Filtering](#advanced-search--filtering)
6. [Bulk Operations](#bulk-operations)
7. [Notification System](#notification-system)
8. [Accessibility (WCAG 2.1)](#accessibility-wcag-21)
9. [Additional Enhancements](#additional-enhancements)
10. [Testing Requirements](#testing-requirements)

---

## Collapsible Sidebar

### Status: 🟡 Tier 2 - Medium-High Priority

### Description
Add collapse/expand functionality to the main sidebar to maximize screen real estate for content.

### Current State
- Fixed-width sidebar (~250px)
- Always visible
- No collapse option
- Wastes space on smaller screens

### Proposed Design
```
Expanded State (Default):
┌────────────────────┐
│ 🏠 Dashboard       │
│ 🎯 Operations      │
│ ◉ Targets          │
│ ⚠️ Vulnerabilities │
└────────────────────┘

Collapsed State:
┌──┐
│🏠│ (Tooltip: Dashboard)
│🎯│ (Tooltip: Operations)
│◉│  (Tooltip: Targets)
│⚠️│  (Tooltip: Vulnerabilities)
└──┘
```

### Implementation

The collapsible sidebar enhancement transforms the current fixed-width sidebar into a responsive component that can toggle between full-width (256px) and icon-only (64px) modes. The implementation requires modifications to three key files: `Sidebar.tsx`, `MainLayout.tsx`, and a new `useSidebarCollapse.ts` custom hook.

**Architecture Overview:**
- Use React state with localStorage synchronization for persistence
- Implement CSS transitions for smooth width changes (300ms duration)
- Add keyboard event listeners for Ctrl/Cmd + B shortcut
- Use Radix UI Tooltip for icon labels in collapsed mode
- Create mobile-specific overlay drawer variant

**State Management:**
The sidebar collapse state should be managed through a custom hook to enable consistent behavior across page refreshes and potential future multi-component usage:

```typescript
// client/src/hooks/useSidebarCollapse.ts
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'rtpi_sidebar_collapsed';

export function useSidebarCollapse() {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  const toggle = () => setIsCollapsed(prev => !prev);

  return { isCollapsed, setIsCollapsed, toggle };
}
```

**Updated Sidebar Component:**
Modify `client/src/components/layout/Sidebar.tsx` to support both collapsed and expanded states:

```typescript
// client/src/components/layout/Sidebar.tsx
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  LayoutDashboard, Target, AlertTriangle, Bot, Server,
  Wrench, FileText, Settings, User, ListTodo, Users,
  BarChart3, ChevronLeft, ChevronRight
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
}

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/operations", label: "Operations", icon: ListTodo },
  { path: "/targets", label: "Targets", icon: Target },
  { path: "/vulnerabilities", label: "Vulnerabilities", icon: AlertTriangle },
  { path: "/surface-assessment", label: "Surface Assessment", icon: BarChart3 },
  { path: "/agents", label: "Agents", icon: Bot },
  { path: "/infrastructure", label: "Infrastructure", icon: Server },
  { path: "/tools", label: "Tools", icon: Wrench },
  { path: "/reports", label: "Reports", icon: FileText },
  { path: "/settings", label: "Settings", icon: Settings },
  { path: "/profile", label: "Profile", icon: User },
];

const adminNavItems = [
  { path: "/users", label: "User Management", icon: Users },
];

export default function Sidebar({ isOpen }: SidebarProps) {
  const [location] = useLocation();
  const { isAdmin } = useAuth();
  const { isCollapsed, toggle } = useSidebarCollapse();

  // Keyboard shortcut handler (Ctrl/Cmd + B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  if (!isOpen) return null;

  const NavLink = ({ item }: { item: typeof navItems[0] }) => {
    const Icon = item.icon;
    const isActive = location === item.path;

    const linkContent = (
      <Link
        href={item.path}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
          isActive
            ? "bg-primary/10 text-primary font-medium"
            : "text-foreground hover:bg-secondary"
        } ${isCollapsed ? 'justify-center' : ''}`}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        {!isCollapsed && <span>{item.label}</span>}
      </Link>
    );

    // Wrap in tooltip when collapsed
    if (isCollapsed) {
      return (
        <Tooltip.Provider delayDuration={300}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              {linkContent}
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="right"
                className="bg-popover text-popover-foreground px-3 py-2 rounded-md shadow-md text-sm"
                sideOffset={5}
              >
                {item.label}
                <Tooltip.Arrow className="fill-popover" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      );
    }

    return linkContent;
  };

  return (
    <aside
      className={`bg-background border-r border-border fixed left-0 top-16 bottom-0 overflow-y-auto z-10 transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header with logo and toggle button */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-3 overflow-hidden">
            <img src="/RTPI.png" alt="RTPI" className="h-10 w-10 flex-shrink-0" />
            <div className="overflow-hidden">
              <h2 className="font-bold text-foreground truncate">RTPI</h2>
              <p className="text-xs text-muted-foreground truncate">Red Team Platform</p>
            </div>
          </div>
        )}

        {isCollapsed && (
          <img src="/RTPI.png" alt="RTPI" className="h-8 w-8 mx-auto" />
        )}

        <button
          onClick={toggle}
          className={`p-2 hover:bg-secondary rounded-lg transition-colors ${
            isCollapsed ? 'mx-auto mt-2' : ''
          }`}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand (Ctrl+B)' : 'Collapse (Ctrl+B)'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink key={item.path} item={item} />
        ))}

        {isAdmin() && (
          <>
            {!isCollapsed && (
              <div className="pt-4 pb-2 px-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Administration
                </p>
              </div>
            )}
            {isCollapsed && <div className="pt-4 border-t border-border mt-4" />}

            {adminNavItems.map((item) => (
              <NavLink key={item.path} item={item} />
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}
```

**MainLayout Updates:**
Update `client/src/components/layout/MainLayout.tsx` to adjust content margins based on collapse state:

```typescript
// client/src/components/layout/MainLayout.tsx
import { useState } from "react";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
import Header from "./Header";
import Sidebar from "./Sidebar";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { isCollapsed } = useSidebarCollapse();

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} />
      <main
        className={`pt-16 transition-all duration-300 ${
          sidebarOpen ? (isCollapsed ? "lg:ml-16" : "lg:ml-64") : ""
        }`}
      >
        {children}
      </main>
    </div>
  );
}
```

**Mobile Overlay Implementation:**
For mobile devices (screen width < 1024px), the sidebar should behave as an overlay drawer:

```typescript
// Add to Sidebar.tsx responsive classes
<aside
  className={`bg-background border-r border-border fixed left-0 top-16 bottom-0 overflow-y-auto transition-all duration-300 ease-in-out
    ${isCollapsed ? 'w-16' : 'w-64'}
    lg:z-10 z-50
    lg:translate-x-0 ${!isOpen ? '-translate-x-full lg:translate-x-0' : ''}
  `}
>
```

**CSS Transitions:**
All transitions use Tailwind's built-in `transition-all duration-300` for:
- Sidebar width changes (64px ↔ 256px)
- Content margin adjustments
- Logo and text visibility
- Icon positioning

**Keyboard Accessibility:**
- Ctrl/Cmd + B toggles sidebar state globally
- Focus management maintains tab order
- ARIA labels on toggle button
- Tooltip navigation with keyboard (automatic via Radix UI)

**Integration Checklist:**
1. Install Radix UI Tooltip: `npm install @radix-ui/react-tooltip`
2. Create `useSidebarCollapse.ts` hook
3. Update `Sidebar.tsx` with collapse logic
4. Update `MainLayout.tsx` to respond to collapse state
5. Add mobile overlay behavior with responsive classes
6. Test keyboard shortcut across all pages
7. Verify localStorage persistence after page refresh
8. Test tooltip behavior in collapsed mode
9. Validate accessibility with screen readers
10. Add user preference toggle in Settings page (optional enhancement)

### Features
- Toggle button (hamburger icon)
- Smooth transition animation (300ms)
- Persist state in localStorage
- Keyboard shortcut (Ctrl/Cmd + B)
- Hover tooltips in collapsed mode
- Mobile: Overlay drawer

### Implementation Checklist
- [ ] Add collapse/expand toggle button
- [ ] Implement collapsed state (icon-only)
- [ ] Add smooth transitions
- [ ] Persist state in localStorage
- [ ] Add keyboard shortcut
- [ ] Implement hover tooltips
- [ ] Create mobile overlay drawer
- [ ] Add user preference in Settings

### Estimated Effort
2-3 days

---

## Dark Mode Support

### Status: 🟡 Tier 2 - Medium Priority

### Description
Implement dark mode theme with automatic system preference detection.

### Theme System

RTPI currently has basic dark mode support via localStorage and manual class toggling in `App.tsx`. This enhancement formalizes dark mode into a comprehensive theme system with proper React context, system preference detection, and a complete dark mode color palette based on Tailwind CSS design tokens.

**Current Implementation (App.tsx:23-30):**
```typescript
useEffect(() => {
  const savedDarkMode = localStorage.getItem("darkMode");
  if (savedDarkMode === "true") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}, []);
```

**Enhanced Theme Context Implementation:**
Create `client/src/contexts/ThemeContext.tsx` to replace the basic implementation:

```typescript
// client/src/contexts/ThemeContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'rtpi_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored as Theme) || 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

  // Detect system preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateResolvedTheme = () => {
      if (theme === 'system') {
        setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
      } else {
        setResolvedTheme(theme);
      }
    };

    // Initial resolution
    updateResolvedTheme();

    // Listen for system preference changes
    const handler = () => {
      if (theme === 'system') {
        updateResolvedTheme();
      }
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  // Apply resolved theme to document
  useEffect(() => {
    const root = document.documentElement;

    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [resolvedTheme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
```

**Theme Toggle Component:**
Create `client/src/components/shared/ThemeToggle.tsx` for the UI control:

```typescript
// client/src/components/shared/ThemeToggle.tsx
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const themeOptions = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
  ];

  const currentOption = themeOptions.find(opt => opt.value === theme) || themeOptions[2];
  const CurrentIcon = currentOption.icon;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="p-2 hover:bg-secondary rounded-lg transition-colors"
          aria-label="Toggle theme"
          title={`Current theme: ${theme}${theme === 'system' ? ` (${resolvedTheme})` : ''}`}
        >
          <CurrentIcon className="w-5 h-5" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="bg-popover border border-border rounded-lg shadow-lg p-1 min-w-[160px]"
          sideOffset={5}
        >
          {themeOptions.map((option) => {
            const Icon = option.icon;
            return (
              <DropdownMenu.Item
                key={option.value}
                onClick={() => setTheme(option.value)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer outline-none transition-colors ${
                  theme === option.value
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-secondary'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{option.label}</span>
                {theme === option.value && (
                  <span className="ml-auto text-xs">✓</span>
                )}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
```

**Integration with App.tsx:**
Update `client/src/App.tsx` to use the new ThemeProvider:

```typescript
// client/src/App.tsx
import { Route, Switch } from "wouter";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext"; // Add this import
import MainLayout from "@/components/layout/MainLayout";
// ... other imports

function AppContent() {
  const { user, loading } = useAuth();

  // Remove the old dark mode useEffect - it's now handled by ThemeProvider

  if (loading) {
    return (/* loading state */);
  }

  if (!user) {
    return <Login />;
  }

  return (
    <MainLayout>
      {/* routes */}
    </MainLayout>
  );
}

export default function App() {
  return (
    <ThemeProvider>  {/* Add ThemeProvider wrapper */}
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
```

**Header Integration:**
Add ThemeToggle to `client/src/components/layout/Header.tsx`:

```typescript
// In Header.tsx, add import and component
import ThemeToggle from '@/components/shared/ThemeToggle';

// In the header JSX, add next to other controls:
<div className="flex items-center gap-2">
  <ThemeToggle />
  {/* ... other header controls */}
</div>
```

### Color Palette

**Light Mode:** Current Tailwind design tokens
- Background: `bg-background` → `#ffffff`
- Foreground: `text-foreground` → `#0a0a0a`
- Muted: `bg-muted` → `#f5f5f5`
- Border: `border-border` → `#e5e5e5`
- Primary: `bg-primary` → `#3b82f6` (blue-500)
- Secondary: `bg-secondary` → `#f0f9ff` (blue-50)

**Dark Mode:** Tailwind dark mode classes (configured via `dark:` prefix)
- Background: `dark:bg-background` → `#0a0a0a`
- Foreground: `dark:text-foreground` → `#fafafa`
- Muted: `dark:bg-muted` → `#262626`
- Border: `dark:border-border` → `#404040`
- Primary: `dark:bg-primary` → `#3b82f6` (blue-500, same)
- Secondary: `dark:bg-secondary` → `#1e3a8a` (blue-900)
- Card: `dark:bg-card` → `#171717`
- Popover: `dark:bg-popover` → `#262626`

**Tailwind Configuration (tailwind.config.ts):**
Ensure CSS variables are defined for both light and dark modes:

```typescript
// tailwind.config.ts
export default {
  darkMode: ['class'],
  content: ['./client/index.html', './client/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        border: 'hsl(var(--border))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
      },
    },
  },
};
```

**Global CSS (client/src/index.css):**
Define CSS variables for light and dark themes:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 4%;
    --muted: 0 0% 96%;
    --muted-foreground: 0 0% 45%;
    --border: 0 0% 90%;
    --primary: 217 91% 60%; /* blue-500 */
    --primary-foreground: 0 0% 100%;
    --secondary: 214 100% 97%;
    --secondary-foreground: 0 0% 4%;
    --card: 0 0% 100%;
    --card-foreground: 0 0% 4%;
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 4%;
  }

  .dark {
    --background: 0 0% 4%;
    --foreground: 0 0% 98%;
    --muted: 0 0% 15%;
    --muted-foreground: 0 0% 64%;
    --border: 0 0% 25%;
    --primary: 217 91% 60%; /* same blue-500 */
    --primary-foreground: 0 0% 100%;
    --secondary: 222 47% 25%; /* blue-900 variant */
    --secondary-foreground: 0 0% 98%;
    --card: 0 0% 9%;
    --card-foreground: 0 0% 98%;
    --popover: 0 0% 15%;
    --popover-foreground: 0 0% 98%;
  }
}
```

**Accessibility Considerations:**
- All color combinations maintain WCAG AA contrast ratios (4.5:1 for text, 3:1 for UI)
- Primary blue (#3b82f6) works in both themes
- Test with WebAIM Contrast Checker for all text/background pairs
- Ensure focus indicators are visible in both themes

### Implementation Checklist
- [ ] Create theme context
- [ ] Define dark mode color palette
- [ ] Update all components for theme support
- [ ] Add theme toggle in header/settings
- [ ] Detect system preference
- [ ] Persist theme selection
- [ ] Test all pages in dark mode
- [ ] Ensure accessibility (contrast ratios)

### Estimated Effort
3-4 days

---

## Mobile Responsive Design

### Status: 🟡 Tier 2 - Medium Priority

### Description
Ensure RTPI works on tablet and larger mobile devices with responsive layouts.

### Breakpoints
- **Desktop:** >1024px (current target)
- **Tablet:** 768-1023px (new target for beta)
- **Mobile:** <768px (future - Tier 3)

### Responsive Patterns

RTPI currently targets desktop users (>1024px). This enhancement adds tablet support (768-1023px) as a beta feature, with mobile (<768px) planned for Tier 3. The implementation focuses on responsive layouts using Tailwind's breakpoint system and component-level adaptations.

**Breakpoint Strategy:**
```typescript
// Tailwind breakpoints (default)
// sm: 640px   - Not actively targeted (future mobile)
// md: 768px   - Tablet lower bound
// lg: 1024px  - Desktop lower bound (current primary target)
// xl: 1280px  - Large desktop
// 2xl: 1536px - Extra large desktop
```

**1. Sidebar Responsive Behavior:**

Already partially implemented in the Collapsible Sidebar enhancement. Additional tablet/mobile patterns:

```typescript
// client/src/components/layout/Sidebar.tsx
// Update className to support responsive overlay on mobile/tablet
<aside
  className={`
    bg-background border-r border-border
    fixed left-0 top-16 bottom-0 overflow-y-auto
    transition-all duration-300 ease-in-out
    ${isCollapsed ? 'w-16' : 'w-64'}

    // Mobile (<768px): Overlay with slide-in animation
    ${!isOpen ? '-translate-x-full' : 'translate-x-0'}
    md:translate-x-0  // Always visible on tablet+

    // Z-index: High for mobile overlay, lower for desktop sidebar
    z-50 md:z-10

    // Add backdrop on mobile when open
  `}
>
  {/* Sidebar content */}
</aside>

// Mobile backdrop (add to Sidebar.tsx)
{isOpen && (
  <div
    className="fixed inset-0 bg-black/50 z-40 md:hidden"
    onClick={() => setIsOpen(false)}
    aria-hidden="true"
  />
)}
```

**2. Tables - Responsive Patterns:**

Replace fixed-width tables with responsive variants. Three patterns:

**Pattern A: Horizontal Scroll (simplest):**
```typescript
// Wrap tables in scrollable container
<div className="overflow-x-auto -mx-4 md:mx-0">
  <div className="inline-block min-w-full align-middle">
    <table className="min-w-full divide-y divide-border">
      {/* Table content */}
    </table>
  </div>
</div>
```

**Pattern B: Card View on Mobile (recommended for < 5 columns):**
```typescript
// Example: TargetList.tsx responsive implementation
export default function TargetList({ targets }: { targets: Target[] }) {
  return (
    <>
      {/* Desktop: Table view */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr>
              <th>Hostname</th>
              <th>IP</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {targets.map(target => (
              <tr key={target.id}>
                <td>{target.hostname}</td>
                <td>{target.ip}</td>
                <td>{target.status}</td>
                <td><button>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile/Tablet: Card view */}
      <div className="md:hidden space-y-4">
        {targets.map(target => (
          <div key={target.id} className="bg-card border border-border rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold">{target.hostname}</h3>
              <button className="text-sm text-primary">Edit</button>
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">IP: {target.ip}</p>
              <p className="text-muted-foreground">Status: {target.status}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
```

**Pattern C: Collapsible Columns (for complex tables):**
```typescript
// Hide non-essential columns on smaller screens
<table>
  <thead>
    <tr>
      <th>Name</th>
      <th className="hidden lg:table-cell">Created</th>
      <th className="hidden xl:table-cell">Description</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    {items.map(item => (
      <tr key={item.id}>
        <td>{item.name}</td>
        <td className="hidden lg:table-cell">{item.created}</td>
        <td className="hidden xl:table-cell">{item.description}</td>
        <td>...</td>
      </tr>
    ))}
  </tbody>
</table>
```

**3. Forms - Responsive Layouts:**

Stack form fields vertically on mobile, use grid on larger screens:

```typescript
// Example: OperationForm.tsx
<form className="space-y-6">
  {/* Single column on mobile, 2 columns on tablet+ */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label>Operation Name</label>
      <input type="text" className="w-full" />
    </div>
    <div>
      <label>Type</label>
      <select className="w-full">...</select>
    </div>
  </div>

  {/* Full width field */}
  <div>
    <label>Description</label>
    <textarea className="w-full" rows={4} />
  </div>

  {/* Buttons: Stack on mobile, inline on tablet+ */}
  <div className="flex flex-col md:flex-row gap-3 md:justify-end">
    <button className="w-full md:w-auto" type="button">Cancel</button>
    <button className="w-full md:w-auto" type="submit">Save</button>
  </div>
</form>
```

**4. Charts and Visualizations:**

Use responsive containers and adjust dimensions:

```typescript
// Example: Dashboard charts
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* Chart cards adapt to grid */}
  <div className="bg-card rounded-lg p-4">
    <h3 className="text-sm font-semibold mb-4">Operations by Status</h3>
    <div className="h-48 md:h-64">
      {/* Chart component with responsive height */}
      <ResponsiveChart data={data} />
    </div>
  </div>
</div>

// For Recharts library (example):
import { ResponsiveContainer, BarChart, Bar } from 'recharts';

<ResponsiveContainer width="100%" height="100%">
  <BarChart data={data}>
    <Bar dataKey="value" />
  </BarChart>
</ResponsiveContainer>
```

**5. Page Layouts - Container Widths:**

Adjust padding and max-widths for readability:

```typescript
// Standard page container pattern
<div className="p-4 md:p-6 lg:p-8">
  <div className="max-w-7xl mx-auto">
    {/* Page content */}
  </div>
</div>

// Alternative: Full-width on mobile, contained on desktop
<div className="px-0 md:px-6 lg:px-8 py-6">
  {/* Content */}
</div>
```

**6. Modal/Dialog Responsiveness:**

Full-screen on mobile, centered on desktop:

```typescript
// Using Radix UI Dialog
<Dialog.Portal>
  <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
  <Dialog.Content
    className={`
      fixed z-50
      // Mobile: Full screen
      inset-0 md:inset-auto
      // Desktop: Centered with max width
      md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2
      md:max-w-lg md:w-full
      // Styling
      bg-background rounded-none md:rounded-lg
      p-6
      max-h-screen overflow-y-auto
    `}
  >
    {/* Dialog content */}
  </Dialog.Content>
</Dialog.Portal>
```

**7. Touch-Friendly Interactions:**

Increase tap target sizes for mobile:

```typescript
// Button sizing
<button
  className={`
    px-4 py-2  // Desktop
    md:px-3 md:py-1.5  // Compact on larger screens
    min-h-[44px] md:min-h-0  // Touch target size (44px minimum)
    rounded-lg
  `}
>
  Action
</button>

// Icon buttons
<button
  className="p-3 md:p-2 hover:bg-secondary rounded-lg"
  aria-label="Delete"
>
  <Trash2 className="w-5 h-5" />
</button>
```

**8. Navigation Adaptations:**

Hide text labels in collapsed sidebar on mobile, show icons only:

```typescript
// Already covered in Collapsible Sidebar section
// Additional: Breadcrumbs on mobile
<nav className="flex items-center gap-2 overflow-x-auto">
  {/* Show only last 2 items on mobile */}
  <span className="hidden md:inline">Home</span>
  <span className="hidden md:inline">/</span>
  <span className="hidden md:inline">Operations</span>
  <span className="md:hidden">...</span>
  <span>/</span>
  <span>Operation Details</span>
</nav>
```

**9. Typography and Spacing:**

Adjust font sizes and spacing for readability:

```typescript
// Headings
<h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">
  Dashboard
</h1>

// Body text (typically inherits, but can be adjusted)
<p className="text-sm md:text-base">
  Description text
</p>

// Card padding
<div className="p-4 md:p-6">
  {/* Card content */}
</div>
```

**10. Grid Layouts - Responsive Columns:**

Standard grid patterns for RTPI pages:

```typescript
// 1 column mobile, 2 tablet, 3 desktop (common pattern)
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
  {items.map(item => <ItemCard key={item.id} item={item} />)}
</div>

// Auto-fit pattern (fills available space)
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {items.map(item => <ItemCard key={item.id} item={item} />)}
</div>
```

**Testing Recommendations:**
- Use Chrome DevTools responsive mode (toggle device toolbar)
- Test on actual iPad (768px), iPad Pro (1024px)
- Verify touch interactions on touch-enabled laptops
- Check horizontal scrolling on all pages
- Validate form usability with on-screen keyboard

**Priority Responsive Updates:**
1. Dashboard: Grid layouts for stats and charts
2. Operations page: OperationList card grid
3. Targets page: Table → Card view on mobile
4. Vulnerabilities page: Table with horizontal scroll
5. Forms: All forms should stack vertically on mobile

### Implementation Checklist
- [ ] Audit all pages for responsiveness
- [ ] Update layouts with flexbox/grid
- [ ] Test on tablet sizes
- [ ] Fix broken layouts
- [ ] Add touch-friendly controls
- [ ] Test on actual devices

### Estimated Effort
4-5 days

---

## Keyboard Shortcuts

### Status: 🟡 Tier 2 - Medium Priority

### Description
Add keyboard shortcuts for common actions to increase power user productivity.

### Shortcut Map

Keyboard shortcuts enhance power user productivity by providing quick access to common actions without mouse interaction. The implementation uses a centralized keyboard shortcut manager that handles event delegation, prevents conflicts, and supports context-aware behavior.

**Implementation Architecture:**

Create a custom hook `useKeyboardShortcuts.ts` to manage shortcut registration and execution:

```typescript
// client/src/hooks/useKeyboardShortcuts.ts
import { useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';

type ShortcutHandler = (event: KeyboardEvent) => void;

interface Shortcut {
  key: string;
  ctrlOrCmd?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  handler: ShortcutHandler;
  global?: boolean; // If false, only active on specific pages
  preventInInput?: boolean; // Prevent when focused in input/textarea
}

const registeredShortcuts: Shortcut[] = [];

export function registerShortcut(shortcut: Shortcut) {
  registeredShortcuts.push(shortcut);
  return () => {
    const index = registeredShortcuts.indexOf(shortcut);
    if (index > -1) registeredShortcuts.splice(index, 1);
  };
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore shortcuts when user is typing
      const target = event.target as HTMLElement;
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      const isContentEditable = target.isContentEditable;

      for (const shortcut of registeredShortcuts) {
        // Skip if in input field (unless preventInInput is false)
        if (shortcut.preventInInput !== false && (isInput || isContentEditable)) {
          continue;
        }

        // Check key match
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlOrCmdMatch = shortcut.ctrlOrCmd
          ? (event.ctrlKey || event.metaKey)
          : true;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;

        if (keyMatch && ctrlOrCmdMatch && shiftMatch && altMatch) {
          event.preventDefault();
          shortcut.handler(event);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}

// Export shortcuts for help modal
export function getAllShortcuts(): Shortcut[] {
  return registeredShortcuts;
}
```

**Global Shortcuts Provider:**

Create `client/src/components/shared/GlobalShortcuts.tsx`:

```typescript
// client/src/components/shared/GlobalShortcuts.tsx
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { registerShortcut, useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useSidebarCollapse } from '@/hooks/useSidebarCollapse';
import ShortcutsHelpModal from './ShortcutsHelpModal';

export default function GlobalShortcuts() {
  const [, setLocation] = useLocation();
  const { toggle: toggleSidebar } = useSidebarCollapse();
  const [showHelp, setShowHelp] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  useKeyboardShortcuts(); // Initialize listener

  useEffect(() => {
    // Ctrl/Cmd + K: Global search
    const unregister1 = registerShortcut({
      key: 'k',
      ctrlOrCmd: true,
      description: 'Open global search',
      handler: () => setShowSearch(true),
      global: true,
    });

    // Ctrl/Cmd + B: Toggle sidebar
    const unregister2 = registerShortcut({
      key: 'b',
      ctrlOrCmd: true,
      description: 'Toggle sidebar',
      handler: () => toggleSidebar(),
      global: true,
    });

    // Escape: Close modals
    const unregister3 = registerShortcut({
      key: 'Escape',
      description: 'Close modal or dialog',
      handler: () => {
        setShowSearch(false);
        setShowHelp(false);
      },
      global: true,
      preventInInput: false, // Allow Esc in inputs
    });

    // ?: Show help
    const unregister4 = registerShortcut({
      key: '?',
      shift: true,
      description: 'Show keyboard shortcuts',
      handler: () => setShowHelp(true),
      global: true,
    });

    // Number keys: Navigate to pages
    const navigationShortcuts = [
      { key: '1', path: '/', label: 'Dashboard' },
      { key: '2', path: '/operations', label: 'Operations' },
      { key: '3', path: '/targets', label: 'Targets' },
      { key: '4', path: '/vulnerabilities', label: 'Vulnerabilities' },
      { key: '5', path: '/surface-assessment', label: 'Surface Assessment' },
      { key: '6', path: '/agents', label: 'Agents' },
      { key: '7', path: '/infrastructure', label: 'Infrastructure' },
      { key: '8', path: '/tools', label: 'Tools' },
      { key: '9', path: '/reports', label: 'Reports' },
    ];

    const unregisterNav = navigationShortcuts.map(({ key, path, label }) =>
      registerShortcut({
        key,
        ctrlOrCmd: true,
        description: `Navigate to ${label}`,
        handler: () => setLocation(path),
        global: true,
      })
    );

    return () => {
      unregister1();
      unregister2();
      unregister3();
      unregister4();
      unregisterNav.forEach(fn => fn());
    };
  }, [toggleSidebar, setLocation]);

  return (
    <>
      {showHelp && <ShortcutsHelpModal onClose={() => setShowHelp(false)} />}
      {showSearch && (
        <GlobalSearchModal onClose={() => setShowSearch(false)} />
      )}
    </>
  );
}
```

**Shortcuts Help Modal:**

Create `client/src/components/shared/ShortcutsHelpModal.tsx`:

```typescript
// client/src/components/shared/ShortcutsHelpModal.tsx
import * as Dialog from '@radix-ui/react-dialog';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsHelpModalProps {
  onClose: () => void;
}

export default function ShortcutsHelpModal({ onClose }: ShortcutsHelpModalProps) {
  const shortcuts = [
    { category: 'Navigation', items: [
      { keys: ['Ctrl/⌘', 'K'], description: 'Open global search' },
      { keys: ['Ctrl/⌘', 'B'], description: 'Toggle sidebar' },
      { keys: ['Ctrl/⌘', '1-9'], description: 'Navigate to page' },
    ]},
    { category: 'Actions', items: [
      { keys: ['Ctrl/⌘', 'N'], description: 'New item (context-aware)' },
      { keys: ['Ctrl/⌘', 'E'], description: 'Edit selected item' },
      { keys: ['Ctrl/⌘', 'S'], description: 'Save current form' },
      { keys: ['Ctrl/⌘', 'D'], description: 'Delete selected item' },
    ]},
    { category: 'General', items: [
      { keys: ['Esc'], description: 'Close dialog or modal' },
      { keys: ['?'], description: 'Show this help' },
    ]},
  ];

  return (
    <Dialog.Root open onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-lg shadow-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto z-50"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Keyboard className="w-6 h-6 text-primary" />
              <Dialog.Title className="text-2xl font-bold">
                Keyboard Shortcuts
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                className="p-2 hover:bg-secondary rounded-lg"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-6">
            {shortcuts.map((category) => (
              <div key={category.category}>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {category.category}
                </h3>
                <div className="space-y-2">
                  {category.items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 px-3 hover:bg-secondary rounded-lg transition-colors"
                    >
                      <span className="text-foreground">{item.description}</span>
                      <div className="flex items-center gap-1">
                        {item.keys.map((key, j) => (
                          <kbd
                            key={j}
                            className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground text-center">
              Press <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono">?</kbd>{' '}
              anytime to show this help
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

**Context-Aware Shortcuts:**

Page-specific shortcuts can be registered within page components:

```typescript
// Example: client/src/pages/Operations.tsx
import { useEffect } from 'react';
import { registerShortcut } from '@/hooks/useKeyboardShortcuts';

export default function Operations() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    // Ctrl/Cmd + N: New operation (only on this page)
    const unregister = registerShortcut({
      key: 'n',
      ctrlOrCmd: true,
      description: 'Create new operation',
      handler: () => setShowCreateDialog(true),
      global: false,
    });

    return unregister;
  }, []);

  // ... rest of component
}
```

**Integration with App.tsx:**

```typescript
// client/src/App.tsx
import GlobalShortcuts from '@/components/shared/GlobalShortcuts';

function AppContent() {
  // ... existing code

  return (
    <MainLayout>
      <GlobalShortcuts />  {/* Add this */}
      <Switch>
        {/* routes */}
      </Switch>
    </MainLayout>
  );
}
```

**Complete Shortcut Reference:**

| Shortcut | Action | Context |
|----------|--------|---------|
| `Ctrl/⌘ + K` | Open global search | Global |
| `Ctrl/⌘ + B` | Toggle sidebar | Global |
| `Ctrl/⌘ + 1-9` | Navigate to page by number | Global |
| `Ctrl/⌘ + N` | New operation/target/vuln (context-aware) | Page-specific |
| `Ctrl/⌘ + E` | Edit selected item | Page-specific |
| `Ctrl/⌘ + S` | Save current form | Forms only |
| `Ctrl/⌘ + D` | Delete selected item | Page-specific |
| `Esc` | Close dialog/modal | Global |
| `?` (Shift + /)` | Show keyboard shortcuts help | Global |
| `↑ ↓` | Navigate search results | Search active |
| `Enter` | Select/confirm | Context-aware |
| `Tab` | Next field/item | Forms/lists |
| `Shift + Tab` | Previous field/item | Forms/lists |

### Implementation Checklist
- [ ] Create keyboard shortcut manager
- [ ] Implement global shortcuts
- [ ] Add context-aware shortcuts
- [ ] Create help modal (? key)
- [ ] Add visual indicators
- [ ] Test across browsers
- [ ] Document shortcuts

### Estimated Effort
2-3 days

---

## Advanced Search & Filtering

### Status: 🟡 Tier 2 - Medium-High Priority

### Description
Global search and advanced filtering capabilities across all entities.

### Features

Implement a comprehensive global search system (activated with Ctrl/Cmd + K) that searches across all RTPI entities (operations, targets, vulnerabilities, agents, etc.) with advanced filtering capabilities, saved presets, and intelligent search suggestions.

**Architecture Overview:**

Create three main components:
1. `GlobalSearchModal.tsx` - Command palette-style search interface
2. `useGlobalSearch.ts` - Custom hook for search logic
3. `AdvancedFilters.tsx` - Reusable filter builder for entity lists

**1. Global Search Modal Implementation:**

```typescript
// client/src/components/shared/GlobalSearchModal.tsx
import { useState, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Search, X, FileText, Target, AlertTriangle, Bot, ListTodo } from 'lucide-react';
import { useLocation } from 'wouter';

interface SearchResult {
  id: string;
  type: 'operation' | 'target' | 'vulnerability' | 'agent' | 'report';
  title: string;
  subtitle?: string;
  path: string;
}

interface GlobalSearchModalProps {
  onClose: () => void;
}

export default function GlobalSearchModal({ onClose }: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Search API call
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        setResults(data.results || []);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    }, 300); // Debounce 300ms

    return () => clearTimeout(searchTimeout);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [results, selectedIndex]);

  const handleSelect = (result: SearchResult) => {
    setLocation(result.path);
    onClose();
  };

  const getIcon = (type: string) => {
    const icons = {
      operation: ListTodo,
      target: Target,
      vulnerability: AlertTriangle,
      agent: Bot,
      report: FileText,
    };
    return icons[type] || FileText;
  };

  return (
    <Dialog.Root open onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 animate-in fade-in" />
        <Dialog.Content
          className="fixed top-20 left-1/2 -translate-x-1/2 bg-background rounded-lg shadow-lg w-full max-w-2xl z-50 animate-in slide-in-from-top-4"
        >
          {/* Search input */}
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <Search className="w-5 h-5 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search operations, targets, vulnerabilities..."
              className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {loading && (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-secondary rounded"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {results.length === 0 && query.length >= 2 && !loading && (
              <div className="p-8 text-center text-muted-foreground">
                No results found for "{query}"
              </div>
            )}

            {results.length === 0 && query.length < 2 && (
              <div className="p-8 text-center text-muted-foreground">
                Type at least 2 characters to search
              </div>
            )}

            {results.map((result, index) => {
              const Icon = getIcon(result.type);
              return (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    index === selectedIndex
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-secondary'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{result.title}</div>
                    {result.subtitle && (
                      <div className="text-sm text-muted-foreground truncate">
                        {result.subtitle}
                      </div>
                    )}
                  </div>
                  <span className="text-xs px-2 py-1 bg-muted rounded capitalize">
                    {result.type}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Footer hints */}
          {results.length > 0 && (
            <div className="flex items-center gap-4 px-4 py-3 border-t border-border text-xs text-muted-foreground">
              <span>
                <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded">↑↓</kbd>{' '}
                Navigate
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded">Enter</kbd>{' '}
                Select
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded">Esc</kbd>{' '}
                Close
              </span>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

**2. Backend Search API Endpoint:**

```typescript
// server/api/v1/search.ts
import { Router } from 'express';
import { db } from '@/db';
import { operations, targets, vulnerabilities, agents, reports } from '@/db/schema';
import { or, ilike, sql } from 'drizzle-orm';

const router = Router();

router.get('/search', async (req, res) => {
  const { q } = req.query;

  if (!q || typeof q !== 'string' || q.length < 2) {
    return res.json({ results: [] });
  }

  const query = `%${q}%`;
  const limit = 20;

  try {
    // Search operations
    const opsResults = await db
      .select({
        id: operations.id,
        title: operations.name,
        subtitle: operations.description,
      })
      .from(operations)
      .where(
        or(
          ilike(operations.name, query),
          ilike(operations.description, query)
        )
      )
      .limit(limit);

    // Search targets
    const targetResults = await db
      .select({
        id: targets.id,
        title: targets.hostname,
        subtitle: targets.ip,
      })
      .from(targets)
      .where(
        or(
          ilike(targets.hostname, query),
          ilike(targets.ip, query)
        )
      )
      .limit(limit);

    // Search vulnerabilities
    const vulnResults = await db
      .select({
        id: vulnerabilities.id,
        title: vulnerabilities.name,
        subtitle: vulnerabilities.description,
      })
      .from(vulnerabilities)
      .where(
        or(
          ilike(vulnerabilities.name, query),
          ilike(vulnerabilities.description, query)
        )
      )
      .limit(limit);

    // Combine and format results
    const results = [
      ...opsResults.map(r => ({
        ...r,
        type: 'operation' as const,
        path: `/operations?selected=${r.id}`,
      })),
      ...targetResults.map(r => ({
        ...r,
        type: 'target' as const,
        path: `/targets?selected=${r.id}`,
      })),
      ...vulnResults.map(r => ({
        ...r,
        type: 'vulnerability' as const,
        path: `/vulnerabilities?selected=${r.id}`,
      })),
    ];

    // Sort by relevance (simple: prioritize title matches)
    results.sort((a, b) => {
      const aMatch = a.title.toLowerCase().includes(q.toLowerCase());
      const bMatch = b.title.toLowerCase().includes(q.toLowerCase());
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return 0;
    });

    res.json({ results: results.slice(0, limit) });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
```

**3. Advanced Filters Component (for entity pages):**

```typescript
// client/src/components/shared/AdvancedFilters.tsx
import { useState } from 'react';
import { Filter, X, Save } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';

export interface FilterConfig {
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'between';
  value: any;
}

interface AdvancedFiltersProps {
  fields: Array<{
    key: string;
    label: string;
    type: 'text' | 'select' | 'date' | 'number';
    options?: Array<{ value: string; label: string }>;
  }>;
  filters: FilterConfig[];
  onChange: (filters: FilterConfig[]) => void;
  onSave?: (name: string, filters: FilterConfig[]) => void;
}

export default function AdvancedFilters({
  fields,
  filters,
  onChange,
  onSave,
}: AdvancedFiltersProps) {
  const [open, setOpen] = useState(false);

  const addFilter = () => {
    onChange([
      ...filters,
      { field: fields[0].key, operator: 'equals', value: '' },
    ]);
  };

  const removeFilter = (index: number) => {
    onChange(filters.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, updates: Partial<FilterConfig>) => {
    onChange(
      filters.map((f, i) => (i === index ? { ...f, ...updates } : f))
    );
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="flex items-center gap-2 px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors">
          <Filter className="w-4 h-4" />
          Filters
          {filters.length > 0 && (
            <span className="px-1.5 py-0.5 bg-primary text-primary-foreground rounded text-xs">
              {filters.length}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="bg-popover border border-border rounded-lg shadow-lg p-4 w-96 z-50"
          sideOffset={5}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Advanced Filters</h3>
            <Popover.Close asChild>
              <button className="p-1 hover:bg-secondary rounded">
                <X className="w-4 h-4" />
              </button>
            </Popover.Close>
          </div>

          <div className="space-y-3">
            {filters.map((filter, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-3 bg-background border border-border rounded-lg"
              >
                <select
                  className="flex-1 bg-transparent border-none outline-none"
                  value={filter.field}
                  onChange={(e) => updateFilter(index, { field: e.target.value })}
                >
                  {fields.map((field) => (
                    <option key={field.key} value={field.key}>
                      {field.label}
                    </option>
                  ))}
                </select>

                <select
                  className="bg-transparent border-none outline-none"
                  value={filter.operator}
                  onChange={(e) =>
                    updateFilter(index, { operator: e.target.value as any })
                  }
                >
                  <option value="equals">Equals</option>
                  <option value="contains">Contains</option>
                  <option value="gt">Greater than</option>
                  <option value="lt">Less than</option>
                </select>

                <input
                  type="text"
                  className="flex-1 bg-transparent border-none outline-none"
                  value={filter.value}
                  onChange={(e) => updateFilter(index, { value: e.target.value })}
                />

                <button
                  onClick={() => removeFilter(index)}
                  className="p-1 hover:bg-secondary rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={addFilter}
              className="flex-1 px-3 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
            >
              Add Filter
            </button>
            {onSave && (
              <button
                className="px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
                title="Save preset"
              >
                <Save className="w-4 h-4" />
              </button>
            )}
          </div>

          {filters.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="w-full mt-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary rounded-lg transition-colors"
            >
              Clear all filters
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
```

**4. Usage Example (Targets Page):**

```typescript
// client/src/pages/Targets.tsx
import { useState } from 'react';
import AdvancedFilters, { FilterConfig } from '@/components/shared/AdvancedFilters';

export default function Targets() {
  const [filters, setFilters] = useState<FilterConfig[]>([]);

  const filterFields = [
    { key: 'hostname', label: 'Hostname', type: 'text' as const },
    { key: 'ip', label: 'IP Address', type: 'text' as const },
    { key: 'status', label: 'Status', type: 'select' as const, options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ]},
    { key: 'severity', label: 'Max Severity', type: 'select' as const, options: [
      { value: 'critical', label: 'Critical' },
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' },
    ]},
  ];

  // Apply filters to API query
  const buildQuery = () => {
    const params = new URLSearchParams();
    filters.forEach((f) => {
      params.append(`filter[${f.field}][${f.operator}]`, f.value);
    });
    return params.toString();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Targets</h1>
        <AdvancedFilters
          fields={filterFields}
          filters={filters}
          onChange={setFilters}
        />
      </div>
      {/* Rest of page */}
    </div>
  );
}
```

**Features Summary:**
- **Global Search (Ctrl/Cmd + K)**: Command palette-style modal with keyboard navigation
- **Multi-Entity Search**: Searches across operations, targets, vulnerabilities, agents, reports
- **Advanced Filters**: Reusable filter builder component with field/operator/value triplets
- **Real-time Search**: Debounced API calls (300ms) for responsive UX
- **Keyboard Navigation**: Arrow keys to navigate results, Enter to select, Esc to close
- **Result Highlighting**: Shows entity type badges and preview subtitles
- **Filter Presets** (optional): Save and reuse common filter combinations

### Implementation Checklist
- [ ] Create global search component
- [ ] Implement search API endpoint
- [ ] Add filter builder UI
- [ ] Create saved filter system
- [ ] Add search suggestions
- [ ] Implement keyboard navigation

### Estimated Effort
3-4 days

---

## Bulk Operations

### Status: 🟡 Tier 2 - Medium Priority

### Description
Enable bulk actions on multiple items simultaneously (operations, targets, vulnerabilities, etc.).

### Supported Operations

**Pages with Bulk Delete:**
- **Reports** - Select multiple reports and delete in one action (PRIORITY: HIGH)
- Operations - Bulk status change, delete
- Targets - Bulk delete, tag assignment, operation assignment
- Vulnerabilities - Bulk status change, delete, export
- Agents - Bulk enable/disable, configuration

**Bulk Actions:**
- Bulk delete (with confirmation)
- Bulk status change
- Bulk export (CSV, JSON, PDF)
- Bulk tag assignment
- Bulk operation assignment

### UI Pattern
```
┌─────────────────────────────────────────────────────────────────┐
│ [✓ Select All] [Deselect All]           [Bulk Actions ▼]       │
├─────────────────────────────────────────────────────────────────┤
│ ☑ Item 1                                                        │
│ ☑ Item 2                                                        │
│ ☐ Item 3                                                        │
│                                                                  │
│ 2 items selected                                                │
└─────────────────────────────────────────────────────────────────┘
```

### Reports Page Bulk Delete (HIGH PRIORITY)
```
┌─────────────────────────────────────────────────────────────────┐
│ Reports                                                          │
├─────────────────────────────────────────────────────────────────┤
│ ☐ [Select All]                           [Delete Selected] [▼] │
├─────────────────────────────────────────────────────────────────┤
│ ☑ Penetration Test - C3S-Consulting                            │
│   network_penetration_test • MARKDOWN • 11/22/2025              │
│   [Download] [Delete]                                           │
├─────────────────────────────────────────────────────────────────┤
│ ☑ Penetration Test - Home Network                              │
│   network_penetration_test • MARKDOWN • 11/22/2025              │
│   [Download] [Delete]                                           │
├─────────────────────────────────────────────────────────────────┤
│ ☐ Penetration Test - Win-7-Blue                                 │
│   network_penetration_test • MARKDOWN • 11/15/2025              │
│   [Download] [Delete]                                           │
│                                                                  │
│ 2 items selected        [Cancel] [Delete 2 Reports →]          │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Checkbox selection per report
- Select/Deselect all toggle
- Bulk delete button (only visible when items selected)
- Confirmation dialog before deletion
- Progress indicator for bulk operations
- Success/error notifications

### Implementation Checklist
- [ ] Add checkbox selection mode
- [ ] Implement select all/none
- [ ] Create bulk action menu
- [ ] Add confirmation dialogs
- [ ] Implement progress indicators
- [ ] Add undo capability
- [ ] Handle bulk errors gracefully

### Estimated Effort
2-3 days

---

## Notification System

### Status: 🟡 Tier 2 - Medium Priority

### Description
Toast notifications and notification center for system events and user actions.

### Notification Types
- Success (green)
- Error (red)
- Warning (yellow)
- Info (blue)

### Features

Implement a comprehensive notification system with toast notifications for immediate feedback and a persistent notification center for tracking historical alerts. The system supports multiple notification types (success, error, warning, info) with customizable durations, action buttons, and optional desktop notifications via the Notifications API.

**Architecture Overview:**

Create two main systems:
1. **Toast Notifications** - Temporary, auto-dismissing alerts (bottom-right corner)
2. **Notification Center** - Persistent notification history (header bell icon)

**1. Toast Notification System:**

```typescript
// client/src/components/shared/ToastProvider.tsx
import { createContext, useContext, useState, ReactNode } from 'react';
import { X, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };

    setToasts(prev => [...prev, newToast]);

    // Auto-dismiss after duration (default 5s)
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: Toast[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast;
  onRemove: (id: string) => void;
}) {
  const icons = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const colors = {
    success: 'bg-green-500 border-green-600',
    error: 'bg-red-500 border-red-600',
    warning: 'bg-yellow-500 border-yellow-600',
    info: 'bg-blue-500 border-blue-600',
  };

  const Icon = icons[toast.type];

  return (
    <div
      className={`${colors[toast.type]} text-white border rounded-lg shadow-lg p-4 animate-in slide-in-from-right`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold">{toast.title}</h4>
          {toast.message && (
            <p className="text-sm mt-1 opacity-90">{toast.message}</p>
          )}
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="mt-2 text-sm font-medium underline hover:no-underline"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          onClick={() => onRemove(toast.id)}
          className="p-1 hover:bg-white/20 rounded transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
```

**2. Notification Center:**

```typescript
// client/src/components/shared/NotificationCenter.tsx
import { useState } from 'react';
import { Bell, X, Trash2 } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { useNotifications } from '@/hooks/useNotifications';

export default function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="relative p-2 hover:bg-secondary rounded-lg transition-colors"
          aria-label={`Notifications (${unreadCount} unread)`}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="bg-popover border border-border rounded-lg shadow-lg w-96 max-h-[32rem] flex flex-col z-50"
          sideOffset={5}
          align="end"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-semibold">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
              <Popover.Close asChild>
                <button className="p-1 hover:bg-secondary rounded">
                  <X className="w-4 h-4" />
                </button>
              </Popover.Close>
            </div>
          </div>

          {/* Notifications list */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No notifications</p>
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-border hover:bg-secondary/50 transition-colors ${
                    !notification.read ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm">{notification.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                      <span className="text-xs text-muted-foreground mt-2 block">
                        {formatTimestamp(notification.timestamp)}
                      </span>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      className="p-1 hover:bg-secondary rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function formatTimestamp(timestamp: Date): string {
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return timestamp.toLocaleDateString();
}
```

**3. Notifications Hook:**

```typescript
// client/src/hooks/useNotifications.ts
import { useState, useEffect } from 'react';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      read: false,
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Optional: Request desktop notification permission
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/RTPI.png',
      });
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Persist to localStorage
  useEffect(() => {
    const stored = localStorage.getItem('rtpi_notifications');
    if (stored) {
      const parsed = JSON.parse(stored);
      setNotifications(
        parsed.map((n: any) => ({ ...n, timestamp: new Date(n.timestamp) }))
      );
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('rtpi_notifications', JSON.stringify(notifications));
  }, [notifications]);

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
}
```

**4. Integration with App.tsx:**

```typescript
// client/src/App.tsx
import { ToastProvider } from '@/components/shared/ToastProvider';

export default function App() {
  return (
    <ToastProvider>  {/* Wrap entire app */}
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </ToastProvider>
  );
}
```

**5. Integration with Header.tsx:**

```typescript
// client/src/components/layout/Header.tsx
import NotificationCenter from '@/components/shared/NotificationCenter';

export default function Header() {
  return (
    <header className="...">
      <div className="flex items-center gap-2">
        <NotificationCenter />  {/* Add notification center */}
        <ThemeToggle />
        {/* ... other header controls */}
      </div>
    </header>
  );
}
```

**6. Usage Example:**

```typescript
// In any component
import { useToast } from '@/components/shared/ToastProvider';

export default function SomeComponent() {
  const { addToast } = useToast();

  const handleSuccess = () => {
    addToast({
      type: 'success',
      title: 'Operation Created',
      message: 'Red Team Operation Alpha has been successfully created.',
      duration: 5000,
    });
  };

  const handleError = () => {
    addToast({
      type: 'error',
      title: 'Connection Failed',
      message: 'Unable to reach the target server. Please check network connectivity.',
      duration: 0, // Manual dismiss
      action: {
        label: 'Retry',
        onClick: () => retryConnection(),
      },
    });
  };

  return (/* component UI */);
}
```

**Desktop Notifications (Optional):**

Request permission and show desktop notifications:

```typescript
// client/src/utils/desktopNotifications.ts
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Desktop notifications not supported');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

export function showDesktopNotification(title: string, options?: NotificationOptions) {
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      icon: '/RTPI.png',
      badge: '/RTPI.png',
      ...options,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }
}
```

**Features Summary:**
- **Toast Notifications**: Auto-dismissing alerts in bottom-right corner with configurable duration
- **Notification Center**: Persistent history accessible from header bell icon with unread badge
- **Multiple Types**: Success (green), Error (red), Warning (yellow), Info (blue)
- **Action Buttons**: Optional action buttons in toast notifications for quick actions
- **Unread Tracking**: Visual indicators for unread notifications with mark-all-read functionality
- **Desktop Notifications**: Optional native desktop notifications (requires user permission)
- **Persistence**: Notification history stored in localStorage
- **Keyboard Accessible**: Fully navigable with keyboard and screen reader support

### Implementation Checklist
- [ ] Create toast notification system
- [ ] Add notification center
- [ ] Implement unread tracking
- [ ] Add notification preferences
- [ ] Test desktop notifications
- [ ] Add sound options (optional)

### Estimated Effort
2 days

---

## Accessibility (WCAG 2.1)

### Status: 🟢 Tier 3 - Medium Priority

### Description
Ensure RTPI meets WCAG 2.1 Level AA accessibility standards.

### Requirements

Ensure RTPI meets WCAG 2.1 Level AA accessibility standards to make the platform usable for all users, including those with disabilities. This involves proper semantic HTML, ARIA attributes, keyboard navigation, screen reader support, color contrast compliance, and comprehensive focus management.

**WCAG 2.1 Level AA Compliance Checklist:**

**1. Perceivable - Information and UI components must be presentable**

**Color Contrast (1.4.3):**
- Text contrast ratio: Minimum 4.5:1 for normal text, 3:1 for large text
- UI component contrast: Minimum 3:1 for interactive elements

```typescript
// Verify all color combinations meet WCAG AA standards
// Use WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/

// Example color validation
const colorPairs = [
  { bg: '#ffffff', fg: '#0a0a0a', ratio: 21 },    // ✅ Pass (background/foreground)
  { bg: '#3b82f6', fg: '#ffffff', ratio: 4.5 },  // ✅ Pass (primary button)
  { bg: '#f5f5f5', fg: '#737373', ratio: 3.2 },  // ⚠️ Review (muted text)
];

// Dark mode validation
const darkModePairs = [
  { bg: '#0a0a0a', fg: '#fafafa', ratio: 21 },   // ✅ Pass
  { bg: '#262626', fg: '#fafafa', ratio: 15 },   // ✅ Pass
];
```

**Non-text Contrast (1.4.11):**
- UI components and graphical objects: Minimum 3:1 contrast ratio
- Apply to buttons, form inputs, focus indicators, icons

**Text Spacing (1.4.12):**
```css
/* Ensure text remains readable with user-defined spacing */
* {
  line-height: 1.5 !important;
  letter-spacing: 0.12em !important;
  word-spacing: 0.16em !important;
  paragraph-spacing: 2em !important;
}
```

**2. Operable - UI components and navigation must be operable**

**Keyboard Navigation (2.1.1):**
All functionality must be accessible via keyboard:

```typescript
// Example: Keyboard-accessible dropdown
<button
  onClick={toggleDropdown}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleDropdown();
    }
  }}
  aria-expanded={isOpen}
  aria-haspopup="true"
>
  Actions
</button>

// Keyboard trap in modals (required for accessibility)
<Dialog.Content
  onKeyDown={(e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  }}
  // Focus trap implementation using React Focus Lock
/>
```

**No Keyboard Trap (2.1.2):**
- Use `react-focus-lock` library for modal dialogs
- Ensure Escape key always closes modals
- Tab navigation cycles within modal content

**Focus Visible (2.4.7):**
```css
/* Visible focus indicators for all interactive elements */
:focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: 2px;
  border-radius: 4px;
}

/* Remove default focus outline only when :focus-visible is supported */
:focus:not(:focus-visible) {
  outline: none;
}
```

**Focus Order (2.4.3):**
- Ensure tab order follows visual layout (left-to-right, top-to-bottom)
- Use `tabIndex={0}` for focusable custom elements
- Use `tabIndex={-1}` for programmatically focused elements
- Avoid positive `tabIndex` values

**Skip Links (2.4.1):**
```typescript
// Add skip navigation link at the top of every page
// client/src/components/layout/MainLayout.tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded"
>
  Skip to main content
</a>

<main id="main-content" tabIndex={-1}>
  {children}
</main>
```

**3. Understandable - Information and operation must be understandable**

**ARIA Labels (3.3.2):**
All interactive elements must have accessible names:

```typescript
// Buttons with icon-only content
<button aria-label="Delete operation">
  <Trash2 className="w-4 h-4" />
</button>

// Form inputs
<label htmlFor="operation-name">Operation Name</label>
<input
  id="operation-name"
  type="text"
  aria-required="true"
  aria-invalid={hasError}
  aria-describedby={hasError ? "name-error" : undefined}
/>
{hasError && (
  <span id="name-error" className="text-red-500">
    Operation name is required
  </span>
)}

// Complex widgets
<div
  role="tablist"
  aria-label="Operation details"
>
  <button
    role="tab"
    aria-selected={activeTab === 'overview'}
    aria-controls="overview-panel"
    id="overview-tab"
  >
    Overview
  </button>
</div>
<div
  role="tabpanel"
  id="overview-panel"
  aria-labelledby="overview-tab"
  hidden={activeTab !== 'overview'}
>
  {/* Panel content */}
</div>
```

**Error Identification (3.3.1) & Suggestions (3.3.3):**
```typescript
// Form validation with clear error messages
<form onSubmit={handleSubmit} noValidate>
  <div>
    <label htmlFor="email">Email</label>
    <input
      id="email"
      type="email"
      aria-invalid={emailError ? 'true' : 'false'}
      aria-describedby={emailError ? 'email-error' : undefined}
    />
    {emailError && (
      <p id="email-error" role="alert" className="text-red-500">
        <AlertCircle className="w-4 h-4 inline mr-1" aria-hidden="true" />
        {emailError}
      </p>
    )}
  </div>
</form>
```

**4. Robust - Content must be robust enough for assistive technologies**

**Semantic HTML (4.1.1):**
```typescript
// Use proper semantic elements
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/operations">Operations</a></li>
  </ul>
</nav>

<main>
  <h1>Dashboard</h1>
  <section aria-labelledby="recent-ops">
    <h2 id="recent-ops">Recent Operations</h2>
    {/* Content */}
  </section>
</main>

<aside aria-label="Filters">
  {/* Sidebar content */}
</aside>
```

**Name, Role, Value (4.1.2):**
All custom UI components must expose proper roles and states:

```typescript
// Custom checkbox
<div
  role="checkbox"
  aria-checked={isChecked}
  aria-labelledby="checkbox-label"
  tabIndex={0}
  onClick={toggleChecked}
  onKeyDown={(e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggleChecked();
    }
  }}
>
  {/* Visual checkbox */}
</div>
<span id="checkbox-label">Enable notifications</span>

// Custom toggle switch
<button
  role="switch"
  aria-checked={isEnabled}
  onClick={toggle}
  className={isEnabled ? 'bg-primary' : 'bg-secondary'}
>
  <span className="sr-only">
    {isEnabled ? 'Disable' : 'Enable'} dark mode
  </span>
</button>
```

**Screen Reader Only Class:**
```css
/* Utility class for screen reader-only content */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.sr-only:focus {
  position: static;
  width: auto;
  height: auto;
  padding: inherit;
  margin: inherit;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
```

**5. Accessibility Testing Tools:**

**Automated Testing:**
```bash
# Install axe-core for automated accessibility testing
npm install --save-dev @axe-core/react

# Use in development environment
# client/src/main.tsx (development only)
if (import.meta.env.DEV) {
  import('@axe-core/react').then((axe) => {
    axe.default(React, ReactDOM, 1000);
  });
}
```

**Manual Testing Checklist:**
- [ ] Navigate entire app using only keyboard (Tab, Shift+Tab, Enter, Space, Esc, Arrow keys)
- [ ] Test with screen readers (NVDA on Windows, VoiceOver on macOS)
- [ ] Verify all images have alt text (decorative images: `alt=""`)
- [ ] Check all form inputs have associated labels
- [ ] Ensure error messages are announced to screen readers
- [ ] Verify focus indicators are visible on all interactive elements
- [ ] Test color contrast with browser DevTools or WebAIM checker
- [ ] Verify page content reflows at 200% zoom without horizontal scrolling
- [ ] Check that all functionality works without mouse/trackpad

**Browser Extensions for Testing:**
- axe DevTools (Chrome/Firefox)
- WAVE Evaluation Tool
- Lighthouse Accessibility Audit (Chrome DevTools)
- Screen Reader (NVDA for Windows, VoiceOver for macOS)

**6. Accessibility Statement:**

Create `client/public/accessibility.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Accessibility Statement - RTPI</title>
</head>
<body>
  <h1>Accessibility Statement for RTPI</h1>

  <p>RTPI is committed to ensuring digital accessibility for people with disabilities. We continually improve the user experience for everyone and apply the relevant accessibility standards.</p>

  <h2>Conformance Status</h2>
  <p>The Web Content Accessibility Guidelines (WCAG) define requirements for designers and developers to improve accessibility for people with disabilities. It defines three levels of conformance: Level A, Level AA, and Level AAA. RTPI is partially conformant with WCAG 2.1 level AA.</p>

  <h2>Feedback</h2>
  <p>We welcome your feedback on the accessibility of RTPI. Please contact us if you encounter accessibility barriers.</p>

  <h2>Date</h2>
  <p>This statement was created on [Date] and last reviewed on [Date].</p>
</body>
</html>
```

**Implementation Priority:**
1. **High Priority**: Keyboard navigation, focus indicators, ARIA labels, color contrast
2. **Medium Priority**: Screen reader testing, skip links, error handling
3. **Low Priority**: Accessibility statement, advanced ARIA patterns

**Compliance Summary:**
- ✅ Perceivable: Color contrast, text spacing, responsive design
- ✅ Operable: Keyboard navigation, focus management, skip links
- ✅ Understandable: Clear labels, error messages, consistent navigation
- ✅ Robust: Semantic HTML, proper ARIA roles, assistive technology support

### Implementation Checklist
- [ ] Audit current accessibility
- [ ] Add ARIA labels to all interactive elements
- [ ] Ensure keyboard navigation works
- [ ] Test with screen readers
- [ ] Check color contrast ratios
- [ ] Add skip navigation links
- [ ] Create accessibility statement

### Estimated Effort
3-4 days

---

## Additional Enhancements

### Form Improvements
- [ ] Auto-save drafts
- [ ] Form validation with helpful messages
- [ ] Required field indicators
- [ ] Character counters for text fields
- [ ] Smart defaults

### Data Tables
- [ ] Column resizing
- [ ] Column reordering
- [ ] Sticky headers
- [ ] Row selection
- [ ] Export to CSV/Excel

### Loading States
- [ ] Skeleton screens
- [ ] Progress indicators
- [ ] Optimistic UI updates
- [ ] Error boundaries

### Empty States
- [ ] Helpful empty state messages
- [ ] Quick action buttons
- [ ] Getting started guides

**Implementation Notes:**

These additional enhancements represent incremental improvements to the core UI/UX features documented above. While not critical for the initial implementation, they significantly improve the overall user experience and should be prioritized based on user feedback and usage analytics.

**Form Improvements:**
- **Auto-save drafts**: Prevent data loss on large forms (e.g., operation creation, report drafting) by automatically saving to localStorage every 30 seconds. Show "Draft saved at HH:MM" indicator.
- **Form validation**: Use libraries like `react-hook-form` with `zod` for type-safe validation. Display inline error messages immediately on blur, not just on submit.
- **Required field indicators**: Add red asterisk (*) next to labels for required fields. Include aria-required attribute for accessibility.
- **Character counters**: Show "X/Y characters" for text inputs with maxLength. Change color to warning when approaching limit (e.g., 90%).
- **Smart defaults**: Pre-fill forms with sensible defaults based on user's previous inputs or current context (e.g., default operation type based on most frequently created).

**Data Tables:**
- **Column resizing**: Use `react-table` library with column resizing plugin. Persist column widths to localStorage per table.
- **Column reordering**: Implement drag-and-drop column reordering with `@dnd-kit/core`. Persist order to user preferences.
- **Sticky headers**: Apply `position: sticky` to table headers so they remain visible during scroll. Critical for long tables.
- **Row selection**: Add checkbox column for multi-select. Sync with bulk operations (delete, export, status change).
- **Export to CSV/Excel**: Generate CSV client-side using `papaparse` library. For Excel, use `xlsx` library to generate proper .xlsx files.

**Loading States:**
- **Skeleton screens**: Replace spinners with content-shaped placeholders (skeleton UI) during initial load. Use Tailwind's `animate-pulse` utility.
- **Progress indicators**: For long-running operations (scans, report generation), show determinate progress bar with percentage. Use WebSocket or polling to get progress updates.
- **Optimistic UI updates**: Immediately update UI when user performs action (e.g., toggle status), then rollback if server request fails. Improves perceived performance.
- **Error boundaries**: Wrap major sections in React Error Boundaries to catch rendering errors gracefully. Show friendly "Something went wrong" message with retry button instead of blank screen.

**Empty States:**
- **Helpful messages**: Replace generic "No items" with context-specific guidance. Example: "No operations yet. Create your first red team operation to get started."
- **Quick action buttons**: Include primary CTA directly in empty state. Example: "Create Operation" button prominently displayed.
- **Getting started guides**: For complex features (Agents, Surface Assessment), show brief onboarding tips or link to documentation in empty state.

**Additional UI Patterns:**
- **Confirmation dialogs**: Use for destructive actions (delete, reset). Include action name in dialog title ("Delete 5 targets?") and require explicit confirmation (type "DELETE" for bulk operations).
- **Undo/Redo**: Implement undo stack for critical actions like bulk delete. Show toast with "Undo" button for 5 seconds after action.
- **Command palette**: Enhance Ctrl+K global search to include command shortcuts (e.g., "New Operation", "Export Reports"). Similar to VSCode command palette.
- **Recent items**: Add "Recently Viewed" section to Dashboard showing last 5 accessed operations/targets/vulns for quick navigation.
- **Favorites/Bookmarks**: Allow users to star/favorite important operations or targets for quick access. Add dedicated "Favorites" filter.

**Performance Optimizations:**
- **Virtual scrolling**: For tables with >100 rows, use `react-virtual` to render only visible rows. Dramatically improves performance.
- **Lazy loading**: Code-split routes and components using `React.lazy()` and `Suspense`. Load heavy pages (Reports, Surface Assessment) only when accessed.
- **Image optimization**: Use WebP format with PNG fallback. Lazy load images below fold. Implement blur-up loading technique for better UX.
- **Debounced search**: Debounce search inputs by 300ms to reduce API calls. Show loading indicator during debounce period.
- **Memoization**: Use `React.memo()`, `useMemo()`, and `useCallback()` to prevent unnecessary re-renders on data-heavy pages (Vulnerabilities, Targets).

**Priority Ranking:**
1. **Tier 1 (Immediate)**: Form validation, loading states, error boundaries, empty states
2. **Tier 2 (Near-term)**: Column resizing, sticky headers, row selection, CSV export, skeleton screens
3. **Tier 3 (Future)**: Auto-save drafts, column reordering, optimistic UI, undo/redo, command palette enhancements

These enhancements should be implemented iteratively based on user feedback and analytics showing which features are most frequently used.

---

## Testing Requirements

### Unit Tests
- [ ] Sidebar collapse logic
- [ ] Theme switching
- [ ] Keyboard shortcut handling
- [ ] Notification system

**Target Coverage:** 75%

### E2E Tests
- [ ] Sidebar collapse/expand
- [ ] Theme switching preserves state
- [ ] Keyboard shortcuts work
- [ ] Bulk operations complete successfully
- [ ] Responsive layouts on different sizes

**Target Coverage:** 70%

### Accessibility Tests
- [ ] Keyboard navigation complete
- [ ] Screen reader compatibility
- [ ] Color contrast compliance
- [ ] ARIA labels present

**Target Coverage:** 90%

---

## Implementation Timeline

### Week 3 (Days 15-21)
- [ ] Collapsible sidebar
- [ ] Dark mode
- [ ] Keyboard shortcuts
- [ ] Advanced filtering

### Week 4 (Days 22-30)
- [ ] Mobile responsive
- [ ] Bulk operations
- [ ] Notification system
- [ ] Accessibility improvements

---

## Dependencies

### External Dependencies
- Tailwind CSS for theming
- react-hot-keys or similar for keyboard shortcuts
- react-toastify or similar for notifications

### Internal Dependencies
- All page components must support theming
- State management for user preferences

---

## Success Metrics

### Functional Requirements
- [ ] All UI enhancements operational
- [ ] No regression in existing functionality
- [ ] Preferences persist correctly

### Performance Requirements
- [ ] Sidebar toggle <100ms
- [ ] Theme switch <200ms
- [ ] Keyboard shortcuts <50ms response

### User Experience
- [ ] Positive beta tester feedback
- [ ] Reduced clicks for common actions
- [ ] Improved navigation speed
- [ ] Better mobile experience

---

## Related Documentation
- [FUTURE-ENHANCEMENTS.md](../FUTURE-ENHANCEMENTS.md) - Parent document
- [DEVELOPMENT.md](../DEVELOPMENT.md) - Development guide

---

**Status Legend:**
- 🔴 Tier 1 - Critical for beta
- 🟡 Tier 2 - Beta enhancement
- 🟢 Tier 3 - Post-beta
- ✅ Complete
- 🚧 In Progress
- ⏸️ Blocked

---

**Last Updated:** December 4, 2025  
**Maintained By:** RTPI Development Team

---

## VERIFICATION SUMMARY (2026-02-04)

### Core Features Status (From v2.0 ROADMAP Phase 2)

**✅ Implemented (4/6 - 67%)**
1. ✅ **Collapsible Sidebar** - `client/src/components/layout/MainLayout.tsx:6-7` useSidebarCollapse hook, lines 15,62-84 with localStorage persistence
2. ✅ **Keyboard Shortcuts** - `client/src/components/shared/KeyboardShortcutsHelp.tsx:23-38` (Ctrl+K, Ctrl+B, Ctrl+/, Escape, Ctrl+N, Ctrl+S), `client/src/components/shared/CommandPalette.tsx` with cmdk
3. ✅ **Notification Center** - `shared/schema.ts:106-190` notifications table, `server/api/v1/notifications.ts:12-50` full CRUD, `client/src/components/shared/NotificationCenter.tsx:28-48` with mark as read/delete/clear
4. ✅ **Saved Filter Presets** - `shared/schema.ts:192-202` filterPresets table, `server/api/v1/filter-presets.ts:21-48` CRUD, `client/src/components/shared/FilterPresets.tsx:23-50` save/load/delete/share

**⚠️ Partially Implemented (2/6 - 33%)**
5. ⚠️ **Mobile Responsive Design** - `client/src/components/layout/MainLayout.tsx:14-31,87` responsive breakpoints and mobile sidebar logic, but comprehensive optimization incomplete
6. ⚠️ **WCAG 2.1 Accessibility** - Radix UI components provide built-in accessibility, but no comprehensive ARIA label audit

### System Implementation Status
- ✅ **Sidebar:** Collapsible with keyboard shortcut (Ctrl+B)
- ✅ **Command Palette:** Global search with Ctrl+K
- ✅ **Notifications:** Real-time bell icon with unread count
- ✅ **Filter Presets:** Save/load/share custom filter configurations
- ⚠️ **Responsive:** Basic infrastructure but needs comprehensive review
- ⚠️ **Accessibility:** Foundation exists but needs full compliance audit

### Missing Features for v2.3
1. Comprehensive mobile optimization (min 768px tablet, touch-friendly buttons)
2. Full WCAG 2.1 compliance audit (color contrast 4.5:1, keyboard navigation, screen reader support)

### Overall Assessment
**Status:** 67% complete. Core UI/UX features operational with excellent keyboard navigation and notification system. Mobile and accessibility need finishing touches for production readiness.

**Last Updated:** February 4, 2026
