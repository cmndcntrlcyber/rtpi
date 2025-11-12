import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Label } from '../../../../client/src/components/ui/label';

describe('Label Component', () => {
  describe('Rendering', () => {
    it('should render label with text', () => {
      render(<Label>Test Label</Label>);
      expect(screen.getByText('Test Label')).toBeInTheDocument();
    });

    it('should render as label element', () => {
      render(<Label data-testid="label">Label</Label>);
      const label = screen.getByTestId('label');
      expect(label.tagName).toBe('LABEL');
    });
  });

  describe('Props and Attributes', () => {
    it('should accept custom className', () => {
      render(<Label className="custom-class" data-testid="label">Label</Label>);
      const label = screen.getByTestId('label');
      expect(label).toHaveClass('custom-class');
    });

    it('should support htmlFor attribute', () => {
      render(<Label htmlFor="input-id" data-testid="label">Label</Label>);
      const label = screen.getByTestId('label');
      expect(label).toHaveAttribute('for', 'input-id');
    });

    it('should associate with input element', () => {
      render(
        <div>
          <Label htmlFor="test-input">Username</Label>
          <input id="test-input" />
        </div>
      );
      const label = screen.getByText('Username');
      expect(label).toHaveAttribute('for', 'test-input');
    });
  });

  describe('Styling', () => {
    it('should have base styling classes', () => {
      render(<Label data-testid="label">Label</Label>);
      const label = screen.getByTestId('label');
      expect(label).toHaveClass('text-sm', 'font-medium');
    });

    it('should have disabled peer styling', () => {
      render(<Label data-testid="label">Label</Label>);
      const label = screen.getByTestId('label');
      expect(label).toHaveClass('peer-disabled:cursor-not-allowed', 'peer-disabled:opacity-70');
    });
  });

  describe('Accessibility', () => {
    it('should be visible', () => {
      render(<Label>Visible Label</Label>);
      const label = screen.getByText('Visible Label');
      expect(label).toBeVisible();
    });

    it('should work with screen readers', () => {
      render(
        <div>
          <Label htmlFor="sr-input">Screen Reader Label</Label>
          <input id="sr-input" aria-labelledby="sr-input" />
        </div>
      );
      expect(screen.getByText('Screen Reader Label')).toBeInTheDocument();
    });
  });
});
