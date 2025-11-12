import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../../../../client/src/components/ui/card';

describe('Card Components', () => {
  describe('Card', () => {
    it('should render card element', () => {
      render(<Card data-testid="card">Content</Card>);
      expect(screen.getByTestId('card')).toBeInTheDocument();
    });

    it('should render as div element', () => {
      render(<Card data-testid="card">Content</Card>);
      const card = screen.getByTestId('card');
      expect(card.tagName).toBe('DIV');
    });

    it('should have base styling classes', () => {
      render(<Card data-testid="card">Content</Card>);
      const card = screen.getByTestId('card');
      expect(card).toHaveClass('rounded-lg', 'border', 'bg-card', 'shadow-sm');
    });

    it('should accept custom className', () => {
      render(<Card className="custom-class" data-testid="card">Content</Card>);
      const card = screen.getByTestId('card');
      expect(card).toHaveClass('custom-class');
    });

    it('should render children', () => {
      render(<Card>Test Content</Card>);
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });
  });

  describe('CardHeader', () => {
    it('should render card header', () => {
      render(<CardHeader data-testid="card-header">Header</CardHeader>);
      expect(screen.getByTestId('card-header')).toBeInTheDocument();
    });

    it('should have header styling classes', () => {
      render(<CardHeader data-testid="card-header">Header</CardHeader>);
      const header = screen.getByTestId('card-header');
      expect(header).toHaveClass('flex', 'flex-col', 'space-y-1.5', 'p-6');
    });

    it('should accept custom className', () => {
      render(<CardHeader className="custom-header" data-testid="card-header">Header</CardHeader>);
      const header = screen.getByTestId('card-header');
      expect(header).toHaveClass('custom-header');
    });
  });

  describe('CardTitle', () => {
    it('should render card title', () => {
      render(<CardTitle>Title Text</CardTitle>);
      expect(screen.getByText('Title Text')).toBeInTheDocument();
    });

    it('should render as h3 element', () => {
      render(<CardTitle data-testid="card-title">Title</CardTitle>);
      const title = screen.getByTestId('card-title');
      expect(title.tagName).toBe('H3');
    });

    it('should have title styling classes', () => {
      render(<CardTitle data-testid="card-title">Title</CardTitle>);
      const title = screen.getByTestId('card-title');
      expect(title).toHaveClass('text-2xl', 'font-semibold', 'leading-none', 'tracking-tight');
    });

    it('should accept custom className', () => {
      render(<CardTitle className="custom-title" data-testid="card-title">Title</CardTitle>);
      const title = screen.getByTestId('card-title');
      expect(title).toHaveClass('custom-title');
    });
  });

  describe('CardDescription', () => {
    it('should render card description', () => {
      render(<CardDescription>Description text</CardDescription>);
      expect(screen.getByText('Description text')).toBeInTheDocument();
    });

    it('should render as p element', () => {
      render(<CardDescription data-testid="card-desc">Description</CardDescription>);
      const desc = screen.getByTestId('card-desc');
      expect(desc.tagName).toBe('P');
    });

    it('should have description styling classes', () => {
      render(<CardDescription data-testid="card-desc">Description</CardDescription>);
      const desc = screen.getByTestId('card-desc');
      expect(desc).toHaveClass('text-sm', 'text-muted-foreground');
    });

    it('should accept custom className', () => {
      render(<CardDescription className="custom-desc" data-testid="card-desc">Description</CardDescription>);
      const desc = screen.getByTestId('card-desc');
      expect(desc).toHaveClass('custom-desc');
    });
  });

  describe('CardContent', () => {
    it('should render card content', () => {
      render(<CardContent data-testid="card-content">Content</CardContent>);
      expect(screen.getByTestId('card-content')).toBeInTheDocument();
    });

    it('should have content styling classes', () => {
      render(<CardContent data-testid="card-content">Content</CardContent>);
      const content = screen.getByTestId('card-content');
      expect(content).toHaveClass('p-6', 'pt-0');
    });

    it('should accept custom className', () => {
      render(<CardContent className="custom-content" data-testid="card-content">Content</CardContent>);
      const content = screen.getByTestId('card-content');
      expect(content).toHaveClass('custom-content');
    });
  });

  describe('CardFooter', () => {
    it('should render card footer', () => {
      render(<CardFooter data-testid="card-footer">Footer</CardFooter>);
      expect(screen.getByTestId('card-footer')).toBeInTheDocument();
    });

    it('should have footer styling classes', () => {
      render(<CardFooter data-testid="card-footer">Footer</CardFooter>);
      const footer = screen.getByTestId('card-footer');
      expect(footer).toHaveClass('flex', 'items-center', 'p-6', 'pt-0');
    });

    it('should accept custom className', () => {
      render(<CardFooter className="custom-footer" data-testid="card-footer">Footer</CardFooter>);
      const footer = screen.getByTestId('card-footer');
      expect(footer).toHaveClass('custom-footer');
    });
  });

  describe('Complete Card Structure', () => {
    it('should render complete card with all components', () => {
      render(
        <Card data-testid="full-card">
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
            <CardDescription>Test Description</CardDescription>
          </CardHeader>
          <CardContent>Test Content</CardContent>
          <CardFooter>Test Footer</CardFooter>
        </Card>
      );

      expect(screen.getByTestId('full-card')).toBeInTheDocument();
      expect(screen.getByText('Test Card')).toBeInTheDocument();
      expect(screen.getByText('Test Description')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
      expect(screen.getByText('Test Footer')).toBeInTheDocument();
    });

    it('should maintain proper structure hierarchy', () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardTitle>Title</CardTitle>
          </CardHeader>
          <CardContent>Content</CardContent>
        </Card>
      );

      const card = container.firstChild;
      expect(card?.childNodes.length).toBeGreaterThan(0);
    });
  });
});
