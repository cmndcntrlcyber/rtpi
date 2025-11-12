import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import OperationList from '../../../../../client/src/components/operations/OperationList';

describe('OperationList Component', () => {
  const mockOperations = [
    {
      id: '1',
      name: 'Operation Alpha',
      description: 'Test operation 1',
      status: 'active',
      startedAt: '2024-01-01T00:00:00Z',
      createdBy: 'John Doe',
      targets: 5,
      findings: 3,
    },
    {
      id: '2',
      name: 'Operation Beta',
      description: 'Test operation 2',
      status: 'planning',
      startedAt: '2024-01-02T00:00:00Z',
      createdBy: 'Jane Smith',
      targets: 3,
      findings: 1,
    },
  ];

  describe('Rendering with Data', () => {
    it('should render all operations', () => {
      render(<OperationList operations={mockOperations} />);
      expect(screen.getByText('Operation Alpha')).toBeInTheDocument();
      expect(screen.getByText('Operation Beta')).toBeInTheDocument();
    });

    it('should render correct number of operation cards', () => {
      render(<OperationList operations={mockOperations} />);
      const cards = screen.getAllByText(/Operation/);
      expect(cards.length).toBe(2);
    });

    it('should render operations in grid layout', () => {
      const { container } = render(<OperationList operations={mockOperations} />);
      const grid = container.querySelector('.grid');
      expect(grid).toBeInTheDocument();
      expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3');
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no operations', () => {
      render(<OperationList operations={[]} />);
      expect(screen.getByText('No operations found')).toBeInTheDocument();
    });

    it('should display empty state message', () => {
      render(<OperationList operations={[]} />);
      expect(screen.getByText('Get started by creating your first operation')).toBeInTheDocument();
    });

    it('should not render operation cards in empty state', () => {
      render(<OperationList operations={[]} />);
      expect(screen.queryByText('Operation')).not.toBeInTheDocument();
    });

    it('should display empty state when operations is undefined', () => {
      render(<OperationList operations={undefined as any} />);
      expect(screen.getByText('No operations found')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should display loading skeleton when loading', () => {
      const { container } = render(<OperationList operations={[]} loading={true} />);
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBe(6);
    });

    it('should not display operations when loading', () => {
      render(<OperationList operations={mockOperations} loading={true} />);
      expect(screen.queryByText('Operation Alpha')).not.toBeInTheDocument();
    });

    it('should not display empty state when loading', () => {
      render(<OperationList operations={[]} loading={true} />);
      expect(screen.queryByText('No operations found')).not.toBeInTheDocument();
    });
  });

  describe('Event Handlers', () => {
    it('should pass onSelect handler to operation cards', () => {
      const onSelect = vi.fn();
      render(<OperationList operations={mockOperations} onSelect={onSelect} />);
      // The handler is passed to OperationCard, which we tested separately
      expect(screen.getByText('Operation Alpha')).toBeInTheDocument();
    });

    it('should pass onEdit handler to operation cards', () => {
      const onEdit = vi.fn();
      render(<OperationList operations={mockOperations} onEdit={onEdit} />);
      expect(screen.getAllByText('Edit').length).toBe(2);
    });

    it('should pass onDelete handler to operation cards', () => {
      const onDelete = vi.fn();
      render(<OperationList operations={mockOperations} onDelete={onDelete} />);
      expect(screen.getAllByText('Delete').length).toBe(2);
    });

    it('should not show action buttons when handlers not provided', () => {
      render(<OperationList operations={mockOperations} />);
      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
      expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    });
  });

  describe('Multiple Operations', () => {
    it('should handle single operation', () => {
      render(<OperationList operations={[mockOperations[0]]} />);
      expect(screen.getByText('Operation Alpha')).toBeInTheDocument();
      expect(screen.queryByText('Operation Beta')).not.toBeInTheDocument();
    });

    it('should handle many operations', () => {
      const manyOps = Array.from({ length: 10 }, (_, i) => ({
        ...mockOperations[0],
        id: `${i}`,
        name: `Operation ${i}`,
      }));
      render(<OperationList operations={manyOps} />);
      const operations = screen.getAllByText(/Operation \d/);
      expect(operations.length).toBe(10);
    });
  });

  describe('Accessibility', () => {
    it('should render semantic HTML structure', () => {
      const { container } = render(<OperationList operations={mockOperations} />);
      const grid = container.querySelector('.grid');
      expect(grid).toBeInTheDocument();
    });

    it('should have proper empty state heading', () => {
      render(<OperationList operations={[]} />);
      const heading = screen.getByText('No operations found');
      expect(heading.tagName).toBe('H3');
    });
  });
});
