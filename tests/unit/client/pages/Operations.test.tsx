import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockOperations = [
  { id: 'op-1', name: 'Active Op', status: 'active', description: 'Test', type: 'penetration-test', startDate: null, endDate: null },
  { id: 'op-2', name: 'Planning Op', status: 'planning', description: '', type: 'assessment', startDate: null, endDate: null },
  { id: 'op-3', name: 'Completed Op', status: 'completed', description: '', type: 'penetration-test', startDate: null, endDate: null },
];

vi.mock('wouter', () => ({
  useLocation: () => ['/operations', vi.fn()],
  useSearchParams: () => [new URLSearchParams()],
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/hooks/useOperations', () => ({
  useOperations: vi.fn(),
  useCreateOperation: () => ({
    create: vi.fn(),
    creating: false,
  }),
  useUpdateOperation: () => ({
    update: vi.fn(),
  }),
  useDeleteOperation: () => ({
    delete: vi.fn(),
  }),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
    patch: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('@/components/operations/OperationList', () => ({
  default: ({ operations }: any) => (
    <div data-testid="operation-list">
      {operations?.map((op: any) => (
        <div key={op.id} data-testid={`op-${op.id}`}>{op.name}</div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/operations/OperationForm', () => ({
  default: ({ open }: any) => open ? <div data-testid="operation-form">Form</div> : null,
}));

vi.mock('@/components/operations/OpsManagerFloatingChat', () => ({
  default: () => null,
}));

vi.mock('@/components/shared/BulkActionToolbar', () => ({
  BulkActionToolbar: () => <div data-testid="bulk-toolbar">BulkToolbar</div>,
}));

vi.mock('@/components/shared/BulkConfirmDialog', () => ({
  BulkConfirmDialog: () => null,
}));

vi.mock('@/components/operations/BugBountyImportCard', () => ({
  default: () => <div data-testid="bug-bounty-import">BugBountyImport</div>,
}));

import { useOperations } from '@/hooks/useOperations';
const mockUseOperations = vi.mocked(useOperations);

describe('Operations Page', () => {
  let Operations: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockUseOperations.mockReturnValue({
      operations: mockOperations,
      loading: false,
      refetch: vi.fn(),
    } as any);
    const mod = await import('../../../../client/src/pages/Operations');
    Operations = mod.default;
  });

  describe('with data', () => {
    it('should render page header', () => {
      render(<Operations />);
      expect(screen.getByText('Operations')).toBeInTheDocument();
    });

    it('should display total operations count', () => {
      render(<Operations />);
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should display the operations list', () => {
      render(<Operations />);
      expect(screen.getByTestId('operation-list')).toBeInTheDocument();
    });

    it('should render status filter labels', () => {
      render(<Operations />);
      expect(screen.getByText('Total Operations')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Planning')).toBeInTheDocument();
    });

    it('should render a New Operation button', () => {
      render(<Operations />);
      expect(screen.getByText('New Operation')).toBeInTheDocument();
    });
  });

  describe('status filter interaction', () => {
    it('should default to active filter with aria-pressed=true', () => {
      render(<Operations />);
      const activeButton = screen.getByText('Active').closest('button');
      expect(activeButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should filter to only active operations by default', () => {
      render(<Operations />);
      const list = screen.getByTestId('operation-list');
      expect(within(list).getByText('Active Op')).toBeInTheDocument();
      expect(within(list).queryByText('Planning Op')).not.toBeInTheDocument();
      expect(within(list).queryByText('Completed Op')).not.toBeInTheDocument();
    });

    it('should deselect filter when clicking the already-active filter', async () => {
      const user = userEvent.setup();
      render(<Operations />);
      const activeButton = screen.getByText('Active').closest('button')!;
      await user.click(activeButton);
      expect(activeButton).toHaveAttribute('aria-pressed', 'false');
      const list = screen.getByTestId('operation-list');
      expect(within(list).getByText('Active Op')).toBeInTheDocument();
      expect(within(list).getByText('Planning Op')).toBeInTheDocument();
      expect(within(list).getByText('Completed Op')).toBeInTheDocument();
    });

    it('should show all operations when Total Operations filter is clicked', async () => {
      const user = userEvent.setup();
      render(<Operations />);
      const totalButton = screen.getByText('Total Operations').closest('button')!;
      await user.click(totalButton);
      const list = screen.getByTestId('operation-list');
      expect(within(list).getByText('Active Op')).toBeInTheDocument();
      expect(within(list).getByText('Planning Op')).toBeInTheDocument();
      expect(within(list).getByText('Completed Op')).toBeInTheDocument();
    });

    it('should filter to planning operations when Planning card is clicked', async () => {
      const user = userEvent.setup();
      render(<Operations />);
      const planningButton = screen.getByText('Planning').closest('button')!;
      await user.click(planningButton);
      const list = screen.getByTestId('operation-list');
      expect(within(list).getByText('Planning Op')).toBeInTheDocument();
      expect(within(list).queryByText('Active Op')).not.toBeInTheDocument();
    });
  });

  describe('bulk mode', () => {
    it('should show Bulk Select button text initially', () => {
      render(<Operations />);
      expect(screen.getByText('Bulk Select')).toBeInTheDocument();
    });

    it('should toggle to Exit Bulk Mode when clicked', async () => {
      const user = userEvent.setup();
      render(<Operations />);
      const bulkButton = screen.getByText('Bulk Select').closest('button')!;
      await user.click(bulkButton);
      expect(screen.getByText('Exit Bulk Mode')).toBeInTheDocument();
    });

    it('should show bulk toolbar when in bulk mode', async () => {
      const user = userEvent.setup();
      render(<Operations />);
      expect(screen.queryByTestId('bulk-toolbar')).not.toBeInTheDocument();
      const bulkButton = screen.getByText('Bulk Select').closest('button')!;
      await user.click(bulkButton);
      expect(screen.getByTestId('bulk-toolbar')).toBeInTheDocument();
    });
  });

  describe('new operation button', () => {
    it('should open form dialog when New Operation is clicked', async () => {
      const user = userEvent.setup();
      render(<Operations />);
      expect(screen.queryByTestId('operation-form')).not.toBeInTheDocument();
      const newOpButton = screen.getByText('New Operation').closest('button')!;
      await user.click(newOpButton);
      expect(screen.getByTestId('operation-form')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    beforeEach(() => {
      mockUseOperations.mockReturnValue({
        operations: [],
        loading: true,
        refetch: vi.fn(),
      } as any);
    });

    it('should show skeleton placeholders in stat cards when loading', () => {
      const { container } = render(<Operations />);
      const skeletons = container.querySelectorAll('[aria-busy="true"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });
});
