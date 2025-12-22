import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OperationCard from '../../../../../client/src/components/operations/OperationCard';

describe('OperationCard Component', () => {
  const mockOperation = {
    id: '1',
    name: 'Test Operation',
    description: 'Test operation description',
    status: 'active',
    startDate: '2024-01-01T12:00:00Z',
    endDate: '2024-01-15T12:00:00Z',
    createdBy: 'John Doe',
    type: 'penetration-test',
    targets: 5,
    findings: 3,
  };

  describe('Rendering', () => {
    it('should render operation card', () => {
      render(<OperationCard operation={mockOperation} />);
      expect(screen.getByText('Test Operation')).toBeInTheDocument();
    });

    it('should display operation name and creator', () => {
      render(<OperationCard operation={mockOperation} />);
      expect(screen.getByText('Test Operation')).toBeInTheDocument();
      expect(screen.getByText(/Created by John Doe/)).toBeInTheDocument();
    });

    it('should display status badge', () => {
      render(<OperationCard operation={mockOperation} />);
      expect(screen.getByText('active')).toBeInTheDocument();
    });

    it('should display description when provided', () => {
      render(<OperationCard operation={mockOperation} />);
      expect(screen.getByText('Test operation description')).toBeInTheDocument();
    });

    it('should not display description when not provided', () => {
      const opWithoutDesc = { ...mockOperation, description: undefined };
      render(<OperationCard operation={opWithoutDesc} />);
      expect(screen.queryByText('Test operation description')).not.toBeInTheDocument();
    });

    it('should display operation type when provided', () => {
      render(<OperationCard operation={mockOperation} />);
      expect(screen.getByText('penetration-test')).toBeInTheDocument();
    });

    it('should display targets count', () => {
      render(<OperationCard operation={mockOperation} />);
      expect(screen.getByText('5 targets')).toBeInTheDocument();
    });

    it('should display findings when provided', () => {
      render(<OperationCard operation={mockOperation} />);
      expect(screen.getByText('3 findings')).toBeInTheDocument();
    });

    it('should display initials from operation name', () => {
      render(<OperationCard operation={mockOperation} />);
      // "Test Operation" -> "TO"
      expect(screen.getByText('TO')).toBeInTheDocument();
    });
  });

  describe('Status Display', () => {
    const statuses = ['planning', 'active', 'paused', 'completed', 'failed'];

    statuses.forEach(status => {
      it(`should display ${status} status`, () => {
        const op = { ...mockOperation, status };
        render(<OperationCard operation={op} />);
        expect(screen.getByText(status)).toBeInTheDocument();
      });
    });
  });

  describe('Date Formatting', () => {
    it('should display start date', () => {
      const { container } = render(<OperationCard operation={mockOperation} />);
      // The formatDate function formats the date based on the system locale
      // We check for the presence of date components rather than exact format
      expect(container.textContent).toMatch(/Jan(uary)?\s+1,\s+2024/);
    });

    it('should display end date when operation is completed', () => {
      const { container } = render(<OperationCard operation={mockOperation} />);
      expect(container.textContent).toContain('Ended');
      // Check for date components
      expect(container.textContent).toMatch(/Jan(uary)?\s+15,\s+2024/);
    });

    it('should display "In progress" when no completion date', () => {
      const activeOp = { ...mockOperation, endDate: undefined };
      render(<OperationCard operation={activeOp} />);
      expect(screen.getByText('In progress')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onSelect when card is clicked', async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();
      
      render(<OperationCard operation={mockOperation} onSelect={onSelect} />);
      
      const card = screen.getByText('Test Operation').closest('div')?.parentElement?.parentElement;
      await user.click(card!);
      
      expect(onSelect).toHaveBeenCalledWith(mockOperation);
    });

    it('should not call onSelect if not provided', async () => {
      const user = userEvent.setup();
      
      render(<OperationCard operation={mockOperation} />);
      
      const card = screen.getByText('Test Operation').closest('div')?.parentElement?.parentElement;
      await user.click(card!);
      
      // Should not throw error
      expect(true).toBe(true);
    });

    it('should call onEdit when edit button is clicked', async () => {
      const onEdit = vi.fn();
      const user = userEvent.setup();
      
      render(<OperationCard operation={mockOperation} onEdit={onEdit} />);
      
      const editButton = screen.getByText('Edit');
      await user.click(editButton);
      
      expect(onEdit).toHaveBeenCalledWith(mockOperation);
    });

    it('should call onDelete when delete button is clicked', async () => {
      const onDelete = vi.fn();
      const user = userEvent.setup();
      
      render(<OperationCard operation={mockOperation} onDelete={onDelete} />);
      
      const deleteButton = screen.getByText('Delete');
      await user.click(deleteButton);
      
      expect(onDelete).toHaveBeenCalledWith(mockOperation);
    });

    it('should stop propagation when edit button is clicked', async () => {
      const onSelect = vi.fn();
      const onEdit = vi.fn();
      const user = userEvent.setup();
      
      render(<OperationCard operation={mockOperation} onSelect={onSelect} onEdit={onEdit} />);
      
      const editButton = screen.getByText('Edit');
      await user.click(editButton);
      
      expect(onEdit).toHaveBeenCalledWith(mockOperation);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('should stop propagation when delete button is clicked', async () => {
      const onSelect = vi.fn();
      const onDelete = vi.fn();
      const user = userEvent.setup();
      
      render(<OperationCard operation={mockOperation} onSelect={onSelect} onDelete={onDelete} />);
      
      const deleteButton = screen.getByText('Delete');
      await user.click(deleteButton);
      
      expect(onDelete).toHaveBeenCalledWith(mockOperation);
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('Action Buttons', () => {
    it('should show edit button when onEdit is provided', () => {
      const onEdit = vi.fn();
      render(<OperationCard operation={mockOperation} onEdit={onEdit} />);
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('should show delete button when onDelete is provided', () => {
      const onDelete = vi.fn();
      render(<OperationCard operation={mockOperation} onDelete={onDelete} />);
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('should not show action buttons when no handlers provided', () => {
      render(<OperationCard operation={mockOperation} />);
      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
      expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    });

    it('should show both buttons when both handlers provided', () => {
      const onEdit = vi.fn();
      const onDelete = vi.fn();
      render(<OperationCard operation={mockOperation} onEdit={onEdit} onDelete={onDelete} />);
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
  });

  describe('Styling and Classes', () => {
    it('should have hover effect', () => {
      const { container } = render(<OperationCard operation={mockOperation} />);
      const card = container.querySelector('.hover\\:shadow-md');
      expect(card).toBeInTheDocument();
    });

    it('should have cursor pointer', () => {
      const { container } = render(<OperationCard operation={mockOperation} />);
      const card = container.querySelector('.cursor-pointer');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle operation with zero targets', () => {
      const op = { ...mockOperation, targets: 0 };
      render(<OperationCard operation={op} />);
      expect(screen.getByText('0 targets')).toBeInTheDocument();
    });

    it('should handle operation with undefined targets', () => {
      const op = { ...mockOperation, targets: undefined };
      render(<OperationCard operation={op} />);
      expect(screen.getByText('0 targets')).toBeInTheDocument();
    });

    it('should handle single letter name', () => {
      const op = { ...mockOperation, name: 'A' };
      const { container } = render(<OperationCard operation={op} />);
      // Single letter 'A' appears in both initials badge and name
      expect(container.textContent).toContain('A');
    });

    it('should handle very long operation name', () => {
      const longName = 'Very Long Operation Name That Should Be Displayed Properly';
      const op = { ...mockOperation, name: longName };
      render(<OperationCard operation={op} />);
      expect(screen.getByText(longName)).toBeInTheDocument();
    });
  });
});
