import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TargetCard from '../../../../../client/src/components/targets/TargetCard';

describe('TargetCard Component', () => {
  const mockTarget = {
    id: '1',
    hostname: 'target-server',
    ipAddress: '192.168.1.100',
    domain: 'example.com',
    port: 443,
    status: 'active',
    operationId: 'op-1',
    notes: 'Test notes',
    lastScanAt: '2024-01-01T00:00:00Z',
  };

  describe('Rendering', () => {
    it('should render target card', () => {
      render(<TargetCard target={mockTarget} />);
      expect(screen.getByText('target-server')).toBeInTheDocument();
    });

    it('should display hostname as primary identifier', () => {
      render(<TargetCard target={mockTarget} />);
      expect(screen.getByText('target-server')).toBeInTheDocument();
    });

    it('should display IP address with port', () => {
      render(<TargetCard target={mockTarget} />);
      expect(screen.getByText('192.168.1.100:443')).toBeInTheDocument();
    });

    it('should display domain when present', () => {
      render(<TargetCard target={mockTarget} />);
      expect(screen.getByText('example.com')).toBeInTheDocument();
    });

    it('should display status badge', () => {
      render(<TargetCard target={mockTarget} />);
      expect(screen.getByText('active')).toBeInTheDocument();
    });

    it('should display notes when provided', () => {
      render(<TargetCard target={mockTarget} />);
      expect(screen.getByText('Test notes')).toBeInTheDocument();
    });

    it('should display last scan date', () => {
      render(<TargetCard target={mockTarget} />);
      expect(screen.getByText(/Last scan:/)).toBeInTheDocument();
    });
  });

  describe('Display Name Fallback', () => {
    it('should use domain when no hostname', () => {
      const target = { ...mockTarget, hostname: undefined };
      const { container } = render(<TargetCard target={target} />);
      // Domain appears as display name
      const heading = container.querySelector('h3');
      expect(heading?.textContent).toBe('example.com');
    });

    it('should use IP when no hostname or domain', () => {
      const target = { ...mockTarget, hostname: undefined, domain: undefined };
      const { container } = render(<TargetCard target={target} />);
      const heading = container.querySelector('h3');
      expect(heading?.textContent).toBe('192.168.1.100');
    });

    it('should show Unknown Target when all identifiers missing', () => {
      const target = { ...mockTarget, hostname: undefined, domain: undefined, ipAddress: undefined };
      render(<TargetCard target={target} />);
      expect(screen.getByText('Unknown Target')).toBeInTheDocument();
    });
  });

  describe('Status Display', () => {
    const statuses = ['active', 'inactive', 'scanning', 'vulnerable', 'secured'];

    statuses.forEach(status => {
      it(`should display ${status} status`, () => {
        const target = { ...mockTarget, status };
        render(<TargetCard target={target} />);
        expect(screen.getByText(status)).toBeInTheDocument();
      });
    });
  });

  describe('Interactions', () => {
    it('should call onSelect when card is clicked', async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();
      
      render(<TargetCard target={mockTarget} onSelect={onSelect} />);
      
      const card = screen.getByText('target-server').closest('div')?.parentElement?.parentElement;
      await user.click(card!);
      
      expect(onSelect).toHaveBeenCalledWith(mockTarget);
    });

    it('should call onScan when scan button is clicked', async () => {
      const onScan = vi.fn();
      const user = userEvent.setup();
      
      render(<TargetCard target={mockTarget} onScan={onScan} />);
      
      const scanButton = screen.getByText('Scan');
      await user.click(scanButton);
      
      expect(onScan).toHaveBeenCalledWith(mockTarget);
    });

    it('should call onEdit when edit button is clicked', async () => {
      const onEdit = vi.fn();
      const user = userEvent.setup();
      
      render(<TargetCard target={mockTarget} onEdit={onEdit} />);
      
      const editButton = screen.getByText('Edit');
      await user.click(editButton);
      
      expect(onEdit).toHaveBeenCalledWith(mockTarget);
    });

    it('should call onDelete when delete button is clicked', async () => {
      const onDelete = vi.fn();
      const user = userEvent.setup();
      
      render(<TargetCard target={mockTarget} onDelete={onDelete} />);
      
      const deleteButton = screen.getByText('Delete');
      await user.click(deleteButton);
      
      expect(onDelete).toHaveBeenCalledWith(mockTarget);
    });

    it('should stop propagation on action buttons', async () => {
      const onSelect = vi.fn();
      const onScan = vi.fn();
      const user = userEvent.setup();
      
      render(<TargetCard target={mockTarget} onSelect={onSelect} onScan={onScan} />);
      
      const scanButton = screen.getByText('Scan');
      await user.click(scanButton);
      
      expect(onScan).toHaveBeenCalledWith(mockTarget);
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('Action Buttons', () => {
    it('should show scan button when onScan provided', () => {
      render(<TargetCard target={mockTarget} onScan={vi.fn()} />);
      expect(screen.getByText('Scan')).toBeInTheDocument();
    });

    it('should show edit button when onEdit provided', () => {
      render(<TargetCard target={mockTarget} onEdit={vi.fn()} />);
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('should show delete button when onDelete provided', () => {
      render(<TargetCard target={mockTarget} onDelete={vi.fn()} />);
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('should show all buttons when all handlers provided', () => {
      render(<TargetCard target={mockTarget} onScan={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
      expect(screen.getByText('Scan')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('should not show buttons when no handlers provided', () => {
      render(<TargetCard target={mockTarget} />);
      expect(screen.queryByText('Scan')).not.toBeInTheDocument();
      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
      expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    });
  });

  describe('Optional Fields', () => {
    it('should not display port when not provided', () => {
      const target = { ...mockTarget, port: undefined };
      const { container } = render(<TargetCard target={target} />);
      expect(screen.getByText('192.168.1.100')).toBeInTheDocument();
      // Check that IP doesn't have port suffix
      expect(container.textContent).not.toContain('192.168.1.100:');
    });

    it('should not display domain section when not provided', () => {
      const target = { ...mockTarget, domain: undefined };
      render(<TargetCard target={target} />);
      expect(screen.queryByText('example.com')).not.toBeInTheDocument();
    });

    it('should not display notes section when not provided', () => {
      const target = { ...mockTarget, notes: undefined };
      render(<TargetCard target={target} />);
      expect(screen.queryByText('Test notes')).not.toBeInTheDocument();
    });

    it('should not display last scan when not provided', () => {
      const target = { ...mockTarget, lastScanAt: undefined };
      render(<TargetCard target={target} />);
      expect(screen.queryByText(/Last scan:/)).not.toBeInTheDocument();
    });
  });
});
