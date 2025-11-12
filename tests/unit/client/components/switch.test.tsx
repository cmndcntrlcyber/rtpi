import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from '../../../../client/src/components/ui/switch';

describe('Switch Component', () => {
  describe('Rendering', () => {
    it('should render switch element', () => {
      render(<Switch data-testid="switch" />);
      expect(screen.getByTestId('switch')).toBeInTheDocument();
    });

    it('should render as button element', () => {
      render(<Switch data-testid="switch" />);
      const switchEl = screen.getByTestId('switch');
      expect(switchEl.tagName).toBe('BUTTON');
    });

    it('should have switch role', () => {
      render(<Switch data-testid="switch" />);
      const switchEl = screen.getByTestId('switch');
      expect(switchEl).toHaveAttribute('role', 'switch');
    });
  });

  describe('State Management', () => {
    it('should handle checked state', () => {
      render(<Switch checked data-testid="switch" />);
      const switchEl = screen.getByTestId('switch');
      expect(switchEl).toHaveAttribute('data-state', 'checked');
    });

    it('should handle unchecked state', () => {
      render(<Switch checked={false} data-testid="switch" />);
      const switchEl = screen.getByTestId('switch');
      expect(switchEl).toHaveAttribute('data-state', 'unchecked');
    });

    it('should handle toggle action', async () => {
      const handleCheckedChange = vi.fn();
      const user = userEvent.setup();
      
      render(<Switch onCheckedChange={handleCheckedChange} data-testid="switch" />);
      const switchEl = screen.getByTestId('switch');
      
      await user.click(switchEl);
      expect(handleCheckedChange).toHaveBeenCalledWith(true);
    });
  });

  describe('Disabled State', () => {
    it('should apply disabled attribute', () => {
      render(<Switch disabled data-testid="switch" />);
      const switchEl = screen.getByTestId('switch');
      expect(switchEl).toBeDisabled();
    });

    it('should not toggle when disabled', async () => {
      const handleCheckedChange = vi.fn();
      const user = userEvent.setup();
      
      render(<Switch disabled onCheckedChange={handleCheckedChange} data-testid="switch" />);
      const switchEl = screen.getByTestId('switch');
      
      await user.click(switchEl);
      expect(handleCheckedChange).not.toHaveBeenCalled();
    });
  });

  describe('Styling', () => {
    it('should accept custom className', () => {
      render(<Switch className="custom-class" data-testid="switch" />);
      const switchEl = screen.getByTestId('switch');
      expect(switchEl).toHaveClass('custom-class');
    });

    it('should have focus ring styling', () => {
      render(<Switch data-testid="switch" />);
      const switchEl = screen.getByTestId('switch');
      expect(switchEl).toHaveClass('focus-visible:ring-2');
    });
  });

  describe('Accessibility', () => {
    it('should support aria-label', () => {
      render(<Switch aria-label="Toggle feature" data-testid="switch" />);
      const switchEl = screen.getByTestId('switch');
      expect(switchEl).toHaveAttribute('aria-label', 'Toggle feature');
    });

    it('should have proper aria-checked attribute', () => {
      const { rerender } = render(<Switch checked={false} data-testid="switch" />);
      let switchEl = screen.getByTestId('switch');
      expect(switchEl).toHaveAttribute('aria-checked', 'false');
      
      rerender(<Switch checked={true} data-testid="switch" />);
      switchEl = screen.getByTestId('switch');
      expect(switchEl).toHaveAttribute('aria-checked', 'true');
    });
  });
});
