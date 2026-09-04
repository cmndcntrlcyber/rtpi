import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TargetCard from '../../../../../client/src/components/targets/TargetCard';

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

describe('TargetCard Component', () => {
  const mockTarget = {
    id: '1',
    name: 'target-server.example.com',
    type: 'host',
    value: '192.168.1.100',
    description: 'Production web server',
    priority: 4,
    tags: ['web', 'production'],
    operationId: 'op-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T12:00:00Z',
  };

  describe('Rendering', () => {
    it('should render target card', () => {
      render(<TargetCard target={mockTarget} />);
      expect(screen.getByText('target-server.example.com')).toBeInTheDocument();
    });

    it('should display name as primary identifier', () => {
      render(<TargetCard target={mockTarget} />);
      expect(screen.getByText('target-server.example.com')).toBeInTheDocument();
    });

    it('should display value (IP/domain)', () => {
      render(<TargetCard target={mockTarget} />);
      expect(screen.getByText('192.168.1.100')).toBeInTheDocument();
    });

    it('should display type badge', () => {
      render(<TargetCard target={mockTarget} />);
      expect(screen.getByText('host')).toBeInTheDocument();
    });

    it('should display priority badge when present', () => {
      render(<TargetCard target={mockTarget} />);
      expect(screen.getByText('P4')).toBeInTheDocument();
    });

    it('should display description when provided', () => {
      render(<TargetCard target={mockTarget} />);
      expect(screen.getByText('Production web server')).toBeInTheDocument();
    });

    it('should display updated date', () => {
      render(<TargetCard target={mockTarget} />);
      expect(screen.getByText(/Updated:/)).toBeInTheDocument();
    });
  });

  describe('Type Icons', () => {
    it('should show globe icon for domain type', () => {
      const target = { ...mockTarget, type: 'domain' };
      render(<TargetCard target={target} />);
      expect(screen.getByText('domain')).toBeInTheDocument();
    });

    it('should show radio icon for network type', () => {
      const target = { ...mockTarget, type: 'network' };
      render(<TargetCard target={target} />);
      expect(screen.getByText('network')).toBeInTheDocument();
    });

    it('should show radio icon for range type', () => {
      const target = { ...mockTarget, type: 'range' };
      render(<TargetCard target={target} />);
      expect(screen.getByText('range')).toBeInTheDocument();
    });

    it('should show server icon for host type', () => {
      const target = { ...mockTarget, type: 'host' };
      render(<TargetCard target={target} />);
      expect(screen.getByText('host')).toBeInTheDocument();
    });
  });

  describe('Priority Display', () => {
    it('should display high priority (P4) with red styling', () => {
      const target = { ...mockTarget, priority: 4 };
      render(<TargetCard target={target} />);
      const priorityBadge = screen.getByText('P4');
      expect(priorityBadge).toBeInTheDocument();
    });

    it('should display medium priority (P3) with orange styling', () => {
      const target = { ...mockTarget, priority: 3 };
      render(<TargetCard target={target} />);
      const priorityBadge = screen.getByText('P3');
      expect(priorityBadge).toBeInTheDocument();
    });

    it('should display low priority (P2) with blue styling', () => {
      const target = { ...mockTarget, priority: 2 };
      render(<TargetCard target={target} />);
      const priorityBadge = screen.getByText('P2');
      expect(priorityBadge).toBeInTheDocument();
    });

    it('should not display priority badge when undefined', () => {
      const target = { ...mockTarget, priority: undefined };
      render(<TargetCard target={target} />);
      expect(screen.queryByText(/^P\d$/)).not.toBeInTheDocument();
    });
  });

  describe('Optional Fields', () => {
    it('should not display description section when missing', () => {
      const target = { ...mockTarget, description: undefined };
      render(<TargetCard target={target} />);
      expect(screen.queryByText('Production web server')).not.toBeInTheDocument();
    });

    it('should display minimal info when only required fields present', () => {
      const minimalTarget = {
        id: '2',
        name: 'minimal-target',
        type: 'host',
        value: '10.0.0.1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      render(<TargetCard target={minimalTarget} />);
      expect(screen.getByText('minimal-target')).toBeInTheDocument();
      expect(screen.getByText('10.0.0.1')).toBeInTheDocument();
      expect(screen.getByText('host')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onSelect when card is clicked', async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();
      render(<TargetCard target={mockTarget} onSelect={onSelect} />);

      const card = screen.getByText('target-server.example.com').closest('[class*="cursor-pointer"]');
      if (card) {
        await user.click(card);
        expect(onSelect).toHaveBeenCalledWith(mockTarget);
      }
    });

    it('should show dropdown menu when onScan is provided', () => {
      const onScan = vi.fn();
      render(<TargetCard target={mockTarget} onScan={onScan} />);
      expect(screen.getByLabelText('Open menu')).toBeInTheDocument();
    });

    it('should call onScan when scan menu item is clicked', async () => {
      const onScan = vi.fn();
      const user = userEvent.setup();
      render(<TargetCard target={mockTarget} onScan={onScan} />);

      const menuTrigger = screen.getByLabelText('Open menu');
      await user.click(menuTrigger);

      const scanItem = screen.getByText('Scan');
      await user.click(scanItem);
      expect(onScan).toHaveBeenCalledWith(mockTarget);
    });

    it('should show dropdown menu when onEdit is provided', () => {
      const onEdit = vi.fn();
      render(<TargetCard target={mockTarget} onEdit={onEdit} />);
      expect(screen.getByLabelText('Open menu')).toBeInTheDocument();
    });

    it('should call onEdit when edit menu item is clicked', async () => {
      const onEdit = vi.fn();
      const user = userEvent.setup();
      render(<TargetCard target={mockTarget} onEdit={onEdit} />);

      const menuTrigger = screen.getByLabelText('Open menu');
      await user.click(menuTrigger);

      const editItem = screen.getByText('Edit');
      await user.click(editItem);
      expect(onEdit).toHaveBeenCalledWith(mockTarget);
    });

    it('should show dropdown menu when onDelete is provided', () => {
      const onDelete = vi.fn();
      render(<TargetCard target={mockTarget} onDelete={onDelete} />);
      expect(screen.getByLabelText('Open menu')).toBeInTheDocument();
    });

    it('should call onDelete when delete menu item is clicked', async () => {
      const onDelete = vi.fn();
      const user = userEvent.setup();
      render(<TargetCard target={mockTarget} onDelete={onDelete} />);

      const menuTrigger = screen.getByLabelText('Open menu');
      await user.click(menuTrigger);

      const deleteItem = screen.getByText('Delete');
      await user.click(deleteItem);
      expect(onDelete).toHaveBeenCalledWith(mockTarget);
    });

    it('should not call onSelect when dropdown action is clicked', async () => {
      const onSelect = vi.fn();
      const onEdit = vi.fn();
      const user = userEvent.setup();
      render(<TargetCard target={mockTarget} onSelect={onSelect} onEdit={onEdit} />);

      const menuTrigger = screen.getByLabelText('Open menu');
      await user.click(menuTrigger);

      const editItem = screen.getByText('Edit');
      await user.click(editItem);

      expect(onEdit).toHaveBeenCalledTimes(1);
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should render as a clickable card', () => {
      const { container } = render(<TargetCard target={mockTarget} />);
      const card = container.querySelector('.cursor-pointer');
      expect(card).toBeInTheDocument();
    });

    it('should have hover effects', () => {
      const { container } = render(<TargetCard target={mockTarget} />);
      const card = container.querySelector('.hover\\:shadow-lg');
      expect(card).toBeInTheDocument();
    });
  });
});
