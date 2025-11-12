import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Textarea } from '../../../../client/src/components/ui/textarea';

describe('Textarea Component', () => {
  describe('Rendering', () => {
    it('should render textarea element', () => {
      render(<Textarea placeholder="Test textarea" />);
      expect(screen.getByPlaceholderText('Test textarea')).toBeInTheDocument();
    });

    it('should render as textarea element', () => {
      render(<Textarea data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea.tagName).toBe('TEXTAREA');
    });
  });

  describe('User Interactions', () => {
    it('should handle text input', async () => {
      const user = userEvent.setup();
      render(<Textarea data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;
      
      await user.type(textarea, 'Hello World');
      expect(textarea.value).toBe('Hello World');
    });

    it('should handle onChange events', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();
      
      render(<Textarea onChange={handleChange} data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      
      await user.type(textarea, 'Test');
      expect(handleChange).toHaveBeenCalled();
    });

    it('should handle multiline input', async () => {
      const user = userEvent.setup();
      render(<Textarea data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;
      
      await user.type(textarea, 'Line 1{Enter}Line 2');
      expect(textarea.value).toContain('Line 1\nLine 2');
    });
  });

  describe('Disabled State', () => {
    it('should apply disabled attribute', () => {
      render(<Textarea disabled data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toBeDisabled();
    });

    it('should not accept input when disabled', async () => {
      const user = userEvent.setup();
      render(<Textarea disabled data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;
      
      await user.type(textarea, 'Test');
      expect(textarea.value).toBe('');
    });

    it('should have disabled styling classes', () => {
      render(<Textarea disabled data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50');
    });
  });

  describe('Props and Attributes', () => {
    it('should accept custom className', () => {
      render(<Textarea className="custom-class" data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toHaveClass('custom-class');
    });

    it('should support placeholder', () => {
      render(<Textarea placeholder="Enter text" />);
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('should support value prop', () => {
      render(<Textarea value="Test value" onChange={() => {}} data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Test value');
    });

    it('should support defaultValue prop', () => {
      render(<Textarea defaultValue="Default" data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Default');
    });

    it('should support rows attribute', () => {
      render(<Textarea rows={5} data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toHaveAttribute('rows', '5');
    });

    it('should support required attribute', () => {
      render(<Textarea required data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toBeRequired();
    });
  });

  describe('Styling', () => {
    it('should have base styling classes', () => {
      render(<Textarea data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toHaveClass('flex', 'min-h-[80px]', 'w-full', 'rounded-md', 'border');
    });

    it('should have focus ring styling', () => {
      render(<Textarea data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toHaveClass('focus-visible:ring-2');
    });

    it('should have placeholder styling', () => {
      render(<Textarea data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toHaveClass('placeholder:text-muted-foreground');
    });
  });

  describe('Accessibility', () => {
    it('should support aria-label', () => {
      render(<Textarea aria-label="Description" data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toHaveAttribute('aria-label', 'Description');
    });

    it('should support aria-describedby', () => {
      render(<Textarea aria-describedby="helper" data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toHaveAttribute('aria-describedby', 'helper');
    });
  });
});
