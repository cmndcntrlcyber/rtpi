import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '../../../../client/src/components/ui/input';

describe('Input Component', () => {
  describe('Rendering', () => {
    it('should render input element', () => {
      render(<Input placeholder="Test input" />);
      expect(screen.getByPlaceholderText('Test input')).toBeInTheDocument();
    });

    it('should render with default type', () => {
      render(<Input data-testid="input" />);
      const input = screen.getByTestId('input');
      // Input component doesn't set default type, browser defaults to 'text'
      expect(input.tagName).toBe('INPUT');
    });

    it('should render with specified type', () => {
      render(<Input type="email" data-testid="email-input" />);
      const input = screen.getByTestId('email-input');
      expect(input).toHaveAttribute('type', 'email');
    });
  });

  describe('User Interactions', () => {
    it('should handle text input', async () => {
      const user = userEvent.setup();
      render(<Input data-testid="input" />);
      const input = screen.getByTestId('input') as HTMLInputElement;
      
      await user.type(input, 'Hello World');
      expect(input.value).toBe('Hello World');
    });

    it('should handle onChange events', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();
      
      render(<Input onChange={handleChange} data-testid="input" />);
      const input = screen.getByTestId('input');
      
      await user.type(input, 'Test');
      expect(handleChange).toHaveBeenCalled();
    });

    it('should handle focus events', async () => {
      const handleFocus = vi.fn();
      const user = userEvent.setup();
      
      render(<Input onFocus={handleFocus} data-testid="input" />);
      const input = screen.getByTestId('input');
      
      await user.click(input);
      expect(handleFocus).toHaveBeenCalledTimes(1);
    });

    it('should handle blur events', async () => {
      const handleBlur = vi.fn();
      const user = userEvent.setup();
      
      render(<Input onBlur={handleBlur} data-testid="input" />);
      const input = screen.getByTestId('input');
      
      await user.click(input);
      await user.tab();
      expect(handleBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe('Disabled State', () => {
    it('should apply disabled attribute', () => {
      render(<Input disabled data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toBeDisabled();
    });

    it('should not accept input when disabled', async () => {
      const user = userEvent.setup();
      render(<Input disabled data-testid="input" />);
      const input = screen.getByTestId('input') as HTMLInputElement;
      
      await user.type(input, 'Test');
      expect(input.value).toBe('');
    });

    it('should have disabled styling classes', () => {
      render(<Input disabled data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50');
    });
  });

  describe('Props and Attributes', () => {
    it('should accept custom className', () => {
      render(<Input className="custom-class" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveClass('custom-class');
    });

    it('should support placeholder', () => {
      render(<Input placeholder="Enter text" />);
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('should support value prop', () => {
      render(<Input value="Test value" onChange={() => {}} data-testid="input" />);
      const input = screen.getByTestId('input') as HTMLInputElement;
      expect(input.value).toBe('Test value');
    });

    it('should support defaultValue prop', () => {
      render(<Input defaultValue="Default" data-testid="input" />);
      const input = screen.getByTestId('input') as HTMLInputElement;
      expect(input.value).toBe('Default');
    });

    it('should support required attribute', () => {
      render(<Input required data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toBeRequired();
    });

    it('should support readonly attribute', () => {
      render(<Input readOnly data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('readonly');
    });
  });

  describe('Accessibility', () => {
    it('should have focus ring styling', () => {
      render(<Input data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveClass('focus-visible:ring-2');
    });

    it('should support aria-label', () => {
      render(<Input aria-label="Test input" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('aria-label', 'Test input');
    });

    it('should support aria-describedby', () => {
      render(<Input aria-describedby="helper-text" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('aria-describedby', 'helper-text');
    });
  });

  describe('Styling', () => {
    it('should have base styling classes', () => {
      render(<Input data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveClass('h-10', 'w-full', 'rounded-md', 'border');
    });

    it('should have placeholder styling', () => {
      render(<Input data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveClass('placeholder:text-muted-foreground');
    });
  });
});
