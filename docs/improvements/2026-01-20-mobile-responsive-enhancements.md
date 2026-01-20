# Mobile Responsive Design Enhancements

**Date:** January 20, 2026
**Status:** Completed
**Week:** 5 - Task 3

## Overview

Comprehensive mobile responsive design improvements to enhance usability on smartphones and tablets. This update introduces touch-friendly controls, responsive table layouts, and mobile-optimized component patterns.

## Changes Made

### 1. ResponsiveTable Component (`client/src/components/ui/responsive-table.tsx`)

A new component that automatically converts table layouts to card-based layouts on mobile devices, providing better UX on small screens.

**Features:**
- Automatic desktop table → mobile card conversion
- Touch-friendly action buttons
- Customizable column visibility per breakpoint
- Loading skeletons for both desktop and mobile
- Empty state handling
- Row click handlers with proper mobile touch feedback

**Usage Example:**
```typescript
<ResponsiveTable
  columns={[
    { key: 'name', label: 'Name', className: 'font-medium' },
    { key: 'status', label: 'Status', render: (item) => <Badge>{item.status}</Badge> },
    { key: 'details', label: 'Details', hideOnMobile: true },
  ]}
  data={items}
  keyExtractor={(item) => item.id}
  onRowClick={(item) => navigate(`/item/${item.id}`)}
  loading={isLoading}
/>
```

### 2. Responsive Utility Functions (`client/src/utils/responsive.ts`)

Centralized responsive design utilities including:

**Touch Target Standards:**
- Mobile: 44x44px (iOS HIG compliant)
- Tablet: 40x40px
- Desktop: 36x36px

**Responsive Spacing:**
```typescript
RESPONSIVE_SPACING.padding.sm  // 'p-3 sm:p-4 md:p-6 lg:p-8'
RESPONSIVE_SPACING.gap.md      // 'gap-4 sm:gap-6 md:gap-8'
```

**Responsive Text Sizes:**
```typescript
RESPONSIVE_TEXT.heading.h1  // 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl'
RESPONSIVE_TEXT.body.md     // 'text-sm sm:text-base md:text-lg'
```

**Responsive Grid Layouts:**
```typescript
RESPONSIVE_GRID.dashboard  // 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
RESPONSIVE_GRID.halves     // 'grid grid-cols-1 md:grid-cols-2'
```

**Helper Functions:**
```typescript
mobileButtonClasses('primary')     // Touch-friendly button classes
mobileInputClasses()               // Touch-friendly input classes
isMobileDevice()                   // Detect mobile device
isTouchDevice()                    // Detect touch support
getBreakpoint()                    // Get current breakpoint
```

### 3. Media Query Hooks (`client/src/hooks/useMediaQuery.ts`)

React hooks for responsive behavior in components:

**useMediaQuery:**
```typescript
const isMobile = useMediaQuery('(max-width: 768px)');
```

**useBreakpoint:**
```typescript
const { isMobile, isTablet, isDesktop, isWide, current } = useBreakpoint();
```

**useIsTouchDevice:**
```typescript
const isTouch = useIsTouchDevice();
```

**useViewportSize:**
```typescript
const { width, height } = useViewportSize();
```

**useOrientation:**
```typescript
const orientation = useOrientation(); // 'portrait' | 'landscape'
```

**usePrefersReducedMotion:**
```typescript
const prefersReducedMotion = usePrefersReducedMotion();
```

## Implementation Guidelines

### 1. Converting Tables to Responsive Tables

**Before:**
```typescript
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {items.map(item => (
      <TableRow key={item.id}>
        <TableCell>{item.name}</TableCell>
        <TableCell>{item.status}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

**After:**
```typescript
<ResponsiveTable
  columns={[
    { key: 'name', label: 'Name' },
    { key: 'status', label: 'Status' },
  ]}
  data={items}
  keyExtractor={(item) => item.id}
  onRowClick={(item) => handleClick(item)}
/>
```

### 2. Making Buttons Touch-Friendly

**Before:**
```typescript
<Button size="sm">Click me</Button>
```

**After:**
```typescript
<Button className={mobileButtonClasses('primary')}>Click me</Button>
```

### 3. Responsive Layouts

**Before:**
```typescript
<div className="grid grid-cols-4 gap-4">
  {/* Cards */}
</div>
```

**After:**
```typescript
<div className={RESPONSIVE_GRID.dashboard}>
  {/* Cards - automatically 1 col on mobile, 4 on desktop */}
</div>
```

### 4. Conditional Rendering Based on Breakpoint

```typescript
const { isMobile } = useBreakpoint();

return (
  <>
    {isMobile ? (
      <MobileNavigation />
    ) : (
      <DesktopNavigation />
    )}
  </>
);
```

### 5. Responsive Spacing

**Before:**
```typescript
<div className="p-8">Content</div>
```

**After:**
```typescript
<div className={RESPONSIVE_SPACING.padding.md}>
  {/* Automatically adjusts: p-4 sm:p-6 md:p-8 lg:p-10 */}
  Content
</div>
```

## Components to Update

### High Priority
1. ✅ Surface Assessment tables (Assets, Services, Vulnerabilities)
2. ⏳ Operations list
3. ⏳ Targets list
4. ⏳ Implants table
5. ⏳ Reports table

### Medium Priority
1. ⏳ Settings pages
2. ⏳ User management
3. ⏳ Tool registry
4. ⏳ Agent workflows

### Existing Good Examples
- Dashboard cards (already responsive with `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`)
- Sidebar (already has mobile drawer with overlay)
- AssetsTab (already uses expandable cards)

## Mobile UX Best Practices Applied

### 1. Touch Targets
- Minimum 44x44px for all interactive elements on mobile
- Extra spacing between touch targets (gap-2 on mobile, gap-1 on desktop)

### 2. Font Sizes
- Base font size never smaller than 16px on mobile (prevents iOS zoom on input focus)
- Responsive text scaling for headings
- Readable line lengths (max-w-prose for text content)

### 3. Input Fields
- Minimum 44px height on mobile
- Proper input types (tel, email, url) for mobile keyboard optimization
- Large, visible labels
- Clear error messages

### 4. Navigation
- Mobile drawer navigation (already implemented in Sidebar)
- Bottom navigation for quick access (can be added if needed)
- Breadcrumbs that collapse on mobile

### 5. Data Display
- Tables convert to cards on mobile
- Important information prioritized in mobile view
- Horizontal scrolling avoided where possible
- Collapsible sections for long content

### 6. Forms
- Stack form fields vertically on mobile
- Full-width inputs on mobile
- Floating action buttons for submit
- Step-by-step wizards for complex forms

## Testing Checklist

- [x] Test on iPhone SE (375px width)
- [x] Test on iPhone 12/13/14 (390px width)
- [x] Test on iPhone 14 Pro Max (430px width)
- [x] Test on iPad Mini (768px width)
- [x] Test on iPad Pro (1024px width)
- [ ] Test landscape orientation
- [ ] Test with device zoom enabled
- [ ] Test with accessibility font size increases
- [ ] Test touch interactions (no hover required)
- [ ] Test form inputs with virtual keyboard open

## Browser Support

- iOS Safari 14+
- Chrome Mobile 90+
- Samsung Internet 14+
- Firefox Mobile 90+

## Accessibility Notes

These responsive improvements also enhance accessibility:
- Touch targets meet WCAG 2.5.5 (Target Size) Level AAA
- Responsive text scales with user preferences
- Media query hooks respect prefers-reduced-motion
- High contrast mode compatible
- Screen reader friendly (proper semantic HTML)

## Performance Considerations

- useMediaQuery hooks use native matchMedia API (efficient)
- Responsive utilities are pure CSS (no JS overhead)
- ResponsiveTable renders only one view (desktop OR mobile, not both)
- No layout shift when switching between views

## Future Enhancements

1. Bottom sheet component for mobile actions
2. Pull-to-refresh for data lists
3. Swipe gestures for common actions
4. Mobile-optimized charts and graphs
5. Progressive Web App (PWA) features
6. Offline support with service workers
7. Native app shell for installed PWA

## Related Documentation

- [WCAG Accessibility Improvements](./2026-01-20-wcag-accessibility-improvements.md)
- [Network Topology View](./2026-01-19-network-topology-view.md)
- [Scan Scheduling](./2026-01-20-scan-scheduling.md)

## References

- [iOS Human Interface Guidelines - Touch Targets](https://developer.apple.com/design/human-interface-guidelines/ios/user-interaction/touch/)
- [Material Design - Touch Targets](https://material.io/design/usability/accessibility.html#layout-and-typography)
- [WCAG 2.1 - Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [MDN - Media Queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Media_Queries)
