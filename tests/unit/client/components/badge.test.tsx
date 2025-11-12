import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../../../../client/src/components/ui/badge';

describe('Badge Component', () => {
  describe('Rendering', () => {
    it('should render badge element', () => {
      render(<Badge data-testid="badge">Test Badge</Badge>);
      expect(screen.getByTestId('badge')).toBeInTheDocument();
    });

    it('should render as div element', () => {
      render(<Badge data-testid="badge">Badge</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge.tagName).toBe('DIV');
    });

    it('should render badge text', () => {
      render(<Badge>Badge Text</Badge>);
      expect(screen.getByText('Badge Text')).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('should render default variant', () => {
      render(<Badge variant="default" data-testid="badge">Default</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass('bg-primary', 'text-primary-foreground');
    });

    it('should render secondary variant', () => {
      render(<Badge variant="secondary" data-testid="badge">Secondary</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass('bg-secondary', 'text-secondary-foreground');
    });

    it('should render destructive variant', () => {
      render(<Badge variant="destructive" data-testid="badge">Destructive</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass('bg-destructive', 'text-destructive-foreground');
    });

    it('should render outline variant', () => {
      render(<Badge variant="outline" data-testid="badge">Outline</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass('text-foreground');
    });

    it('should use default variant when none specified', () => {
      render(<Badge data-testid="badge">No Variant</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass('bg-primary');
    });
  });

  describe('Styling', () => {
    it('should have base styling classes', () => {
      render(<Badge data-testid="badge">Badge</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass(
        'inline-flex',
        'items-center',
        'rounded-full',
        'border',
        'px-2.5',
        'py-0.5',
        'text-xs',
        'font-semibold'
      );
    });

    it('should accept custom className', () => {
      render(<Badge className="custom-class" data-testid="badge">Badge</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass('custom-class');
    });

    it('should have focus ring styling', () => {
      render(<Badge data-testid="badge">Badge</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass('focus:ring-2', 'focus:ring-ring');
    });
  });

  describe('Props and Attributes', () => {
    it('should forward HTML div props', () => {
      render(<Badge data-testid="badge" id="test-badge">Badge</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveAttribute('id', 'test-badge');
    });

    it('should support aria-label', () => {
      render(<Badge aria-label="Status badge" data-testid="badge">Active</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveAttribute('aria-label', 'Status badge');
    });
  });

  describe('Accessibility', () => {
    it('should be visible', () => {
      render(<Badge>Visible Badge</Badge>);
      const badge = screen.getByText('Visible Badge');
      expect(badge).toBeVisible();
    });

    it('should have focus outline', () => {
      render(<Badge data-testid="badge">Badge</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass('focus:outline-none');
    });
  });
});
