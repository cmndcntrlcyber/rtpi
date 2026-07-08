import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TargetList from '../../../../../client/src/components/targets/TargetList';

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: () => ({}),
  useSensors: () => [],
}));

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: vi.fn((arr: any[]) => arr),
  SortableContext: ({ children }: any) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: {},
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

describe('TargetList Component', () => {
  const mockTargets = [
    {
      id: '1',
      name: 'server-1.example.com',
      type: 'host',
      value: '192.168.1.100',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: '2',
      name: 'server-2.example.com',
      type: 'host',
      value: '192.168.1.101',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ];

  const defaultGroupProps = {
    expandedGroups: new Set(['__unassigned__']),
    onToggleGroup: vi.fn(),
    targetOrder: {},
    onDragEnd: vi.fn(),
  };

  describe('Rendering with Data', () => {
    it('should render all targets when group is expanded', () => {
      render(<TargetList targets={mockTargets} {...defaultGroupProps} />);
      expect(screen.getByText('server-1.example.com')).toBeInTheDocument();
      expect(screen.getByText('server-2.example.com')).toBeInTheDocument();
    });

    it('should render grouped layout with collapsible sections', () => {
      const { container } = render(<TargetList targets={mockTargets} {...defaultGroupProps} />);
      const groupContainer = container.querySelector('.space-y-3');
      expect(groupContainer).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no targets', () => {
      render(<TargetList targets={[]} {...defaultGroupProps} />);
      expect(screen.getByText('No targets found')).toBeInTheDocument();
    });

    it('should display empty state message', () => {
      render(<TargetList targets={[]} {...defaultGroupProps} />);
      expect(screen.getByText(/Targets are the systems, networks, or applications/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should display loading skeleton when loading', () => {
      const { container } = render(<TargetList targets={[]} loading={true} {...defaultGroupProps} />);
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should not display targets when loading', () => {
      render(<TargetList targets={mockTargets} loading={true} {...defaultGroupProps} />);
      expect(screen.queryByText('server-1.example.com')).not.toBeInTheDocument();
    });
  });

  describe('Event Handlers', () => {
    it('should pass onSelect handler to target cards', () => {
      const onSelect = vi.fn();
      render(<TargetList targets={mockTargets} onSelect={onSelect} {...defaultGroupProps} />);
      expect(screen.getByText('server-1.example.com')).toBeInTheDocument();
    });

    it('should show dropdown menus when onScan handler is provided', () => {
      const onScan = vi.fn();
      render(<TargetList targets={mockTargets} onScan={onScan} {...defaultGroupProps} />);
      expect(screen.getAllByLabelText('Open menu').length).toBe(2);
    });

    it('should show dropdown menus when onEdit handler is provided', () => {
      const onEdit = vi.fn();
      render(<TargetList targets={mockTargets} onEdit={onEdit} {...defaultGroupProps} />);
      expect(screen.getAllByLabelText('Open menu').length).toBe(2);
    });

    it('should show dropdown menus when onDelete handler is provided', () => {
      const onDelete = vi.fn();
      render(<TargetList targets={mockTargets} onDelete={onDelete} {...defaultGroupProps} />);
      expect(screen.getAllByLabelText('Open menu').length).toBe(2);
    });
  });
});
