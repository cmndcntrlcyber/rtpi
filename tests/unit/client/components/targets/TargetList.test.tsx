import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TargetList from '../../../../../client/src/components/targets/TargetList';

describe('TargetList Component', () => {
  const mockTargets = [
    {
      id: '1',
      hostname: 'server-1',
      ipAddress: '192.168.1.100',
      status: 'active',
    },
    {
      id: '2',
      hostname: 'server-2',
      ipAddress: '192.168.1.101',
      status: 'scanning',
    },
  ];

  describe('Rendering with Data', () => {
    it('should render all targets', () => {
      render(<TargetList targets={mockTargets} />);
      expect(screen.getByText('server-1')).toBeInTheDocument();
      expect(screen.getByText('server-2')).toBeInTheDocument();
    });

    it('should render in grid layout', () => {
      const { container } = render(<TargetList targets={mockTargets} />);
      const grid = container.querySelector('.grid');
      expect(grid).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no targets', () => {
      render(<TargetList targets={[]} />);
      expect(screen.getByText('No targets found')).toBeInTheDocument();
    });

    it('should display empty state message', () => {
      render(<TargetList targets={[]} />);
      expect(screen.getByText(/Add targets to begin scanning/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should display loading skeleton when loading', () => {
      const { container } = render(<TargetList targets={[]} loading={true} />);
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should not display targets when loading', () => {
      render(<TargetList targets={mockTargets} loading={true} />);
      expect(screen.queryByText('server-1')).not.toBeInTheDocument();
    });
  });

  describe('Event Handlers', () => {
    it('should pass onSelect handler to target cards', () => {
      const onSelect = vi.fn();
      render(<TargetList targets={mockTargets} onSelect={onSelect} />);
      expect(screen.getByText('server-1')).toBeInTheDocument();
    });

    it('should pass onScan handler to target cards', () => {
      const onScan = vi.fn();
      render(<TargetList targets={mockTargets} onScan={onScan} />);
      expect(screen.getAllByText('Scan').length).toBe(2);
    });

    it('should pass onEdit handler to target cards', () => {
      const onEdit = vi.fn();
      render(<TargetList targets={mockTargets} onEdit={onEdit} />);
      expect(screen.getAllByText('Edit').length).toBe(2);
    });

    it('should pass onDelete handler to target cards', () => {
      const onDelete = vi.fn();
      render(<TargetList targets={mockTargets} onDelete={onDelete} />);
      expect(screen.getAllByText('Delete').length).toBe(2);
    });
  });
});
