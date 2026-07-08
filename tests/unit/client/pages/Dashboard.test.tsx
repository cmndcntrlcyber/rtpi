import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_OPERATIONS, DEFAULT_TARGETS, DEFAULT_VULNERABILITIES, DEFAULT_AGENTS, DEFAULT_SURFACE_DATA } from '../mock-data';

const mockNavigate = vi.fn();
vi.mock('wouter', () => ({
  useLocation: () => ['/dashboard', mockNavigate],
}));

vi.mock('@/hooks/useOperations', () => ({
  useOperations: vi.fn(),
}));

vi.mock('@/hooks/useTargets', () => ({
  useTargets: vi.fn(),
}));

vi.mock('@/hooks/useVulnerabilities', () => ({
  useVulnerabilities: vi.fn(),
}));

vi.mock('@/hooks/useAgents', () => ({
  useAgents: vi.fn(),
}));

vi.mock('@/hooks/useReporterAgents', () => ({
  useReporterAgents: vi.fn(),
}));

vi.mock('@/hooks/useWorkflows', () => ({
  useWorkflows: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue(DEFAULT_SURFACE_DATA),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

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

vi.mock('@/components/surface-assessment/SummaryStatsCard', () => ({
  default: () => <div data-testid="summary-stats-card">Summary</div>,
}));

vi.mock('@/components/surface-assessment/charts/SeverityDistributionChart', () => ({
  default: () => <div>SeverityChart</div>,
}));

vi.mock('@/components/surface-assessment/charts/StatusDistributionChart', () => ({
  default: () => <div>StatusChart</div>,
}));

vi.mock('@/components/agents/WorkflowProgressCard', () => ({
  default: () => <div data-testid="workflow-progress">WorkflowProgress</div>,
}));

vi.mock('@/components/agents/WorkflowDetailsDialog', () => ({
  default: () => null,
}));

import { useOperations } from '@/hooks/useOperations';
import { useTargets } from '@/hooks/useTargets';
import { useVulnerabilities } from '@/hooks/useVulnerabilities';
import { useAgents } from '@/hooks/useAgents';
import { useReporterAgents } from '@/hooks/useReporterAgents';
import { useWorkflows } from '@/hooks/useWorkflows';

const mockUseOperations = vi.mocked(useOperations);
const mockUseTargets = vi.mocked(useTargets);
const mockUseVulnerabilities = vi.mocked(useVulnerabilities);
const mockUseAgents = vi.mocked(useAgents);
const mockUseReporterAgents = vi.mocked(useReporterAgents);
const mockUseWorkflows = vi.mocked(useWorkflows);

function setDefaultHooks() {
  mockUseOperations.mockReturnValue({
    operations: DEFAULT_OPERATIONS,
    loading: false,
    error: null,
    refetch: vi.fn(),
  } as any);
  mockUseTargets.mockReturnValue({
    targets: DEFAULT_TARGETS,
    loading: false,
    error: null,
    refetch: vi.fn(),
  } as any);
  mockUseVulnerabilities.mockReturnValue({
    vulnerabilities: DEFAULT_VULNERABILITIES,
    loading: false,
    error: null,
    refetch: vi.fn(),
  } as any);
  mockUseAgents.mockReturnValue({
    agents: DEFAULT_AGENTS,
    loading: false,
    error: null,
    refetch: vi.fn(),
  } as any);
  mockUseReporterAgents.mockReturnValue({
    agents: [],
    loading: false,
  } as any);
  mockUseWorkflows.mockReturnValue({
    runningWorkflows: [],
    allNonRunning: [],
    getWorkflowDetails: vi.fn(),
    cancelWorkflow: vi.fn(),
    connected: false,
    workflowEventTick: 0,
  } as any);
}

describe('Dashboard Page', () => {
  let Dashboard: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    setDefaultHooks();
    const mod = await import('../../../../client/src/pages/Dashboard');
    Dashboard = mod.default;
  });

  describe('with data', () => {
    it('should render the dashboard page header', () => {
      render(<Dashboard />);
      expect(screen.getByText('RTPI Dashboard')).toBeInTheDocument();
    });

    it('should display Active Operations stat card', () => {
      render(<Dashboard />);
      expect(screen.getByText('Active Operations')).toBeInTheDocument();
    });

    it('should display Targets stat card', () => {
      render(<Dashboard />);
      expect(screen.getAllByText(/Targets/).length).toBeGreaterThan(0);
    });

    it('should display Vulnerabilities stat card', () => {
      render(<Dashboard />);
      expect(screen.getAllByText(/Vulnerabilities/).length).toBeGreaterThan(0);
    });

    it('should render Operations row in draggable list', async () => {
      render(<Dashboard />);
      await waitFor(() => {
        expect(screen.getByText('Operations')).toBeInTheDocument();
      });
    });

    it('should render Targets row in draggable list', async () => {
      render(<Dashboard />);
      await waitFor(() => {
        expect(screen.getAllByText(/Targets/).length).toBeGreaterThan(0);
      });
    });

    it('should render the Surface Assessment row', async () => {
      render(<Dashboard />);
      await waitFor(() => {
        expect(screen.getByText('Surface Assessment')).toBeInTheDocument();
      });
    });
  });

  describe('stat card values', () => {
    it('should display correct active operations count', () => {
      render(<Dashboard />);
      const activeOpsCard = screen.getByText('Active Operations').closest('div');
      expect(activeOpsCard).toHaveTextContent('1');
    });

    it('should display correct targets count', () => {
      const { container } = render(<Dashboard />);
      const statCards = container.querySelectorAll('div.bg-card');
      const targetsCard = Array.from(statCards).find(c => c.textContent?.includes('Targets') && c.querySelector('h3'));
      expect(targetsCard).toHaveTextContent('3');
    });

    it('should display correct vulnerabilities count', () => {
      const { container } = render(<Dashboard />);
      const statCards = container.querySelectorAll('div.bg-card');
      const vulnCard = Array.from(statCards).find(c => c.textContent?.includes('Vulnerabilities') && c.querySelector('h3'));
      expect(vulnCard).toHaveTextContent('1');
    });

    it('should display correct active agents count', () => {
      render(<Dashboard />);
      const card = screen.getByText('Active Agents').closest('div');
      expect(card).toHaveTextContent('1');
    });
  });

  describe('navigation', () => {
    it('should navigate to /operations when Active Operations card is clicked', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);
      const card = screen.getByText('Active Operations').closest('div.bg-card')!;
      await user.click(card);
      expect(mockNavigate).toHaveBeenCalledWith('/operations');
    });

    it('should navigate to /targets when Targets card is clicked', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);
      const cards = screen.getAllByText('Targets');
      const statCard = cards.find(el => el.closest('div.bg-card'))?.closest('div.bg-card');
      if (statCard) {
        await user.click(statCard);
        expect(mockNavigate).toHaveBeenCalledWith('/targets');
      }
    });

    it('should navigate to /vulnerabilities when Vulnerabilities card is clicked', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);
      const cards = screen.getAllByText('Vulnerabilities');
      const statCard = cards.find(el => el.closest('div.bg-card'))?.closest('div.bg-card');
      if (statCard) {
        await user.click(statCard);
        expect(mockNavigate).toHaveBeenCalledWith('/vulnerabilities');
      }
    });

    it('should navigate to /agents when Active Agents card is clicked', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);
      const card = screen.getByText('Active Agents').closest('div.bg-card')!;
      await user.click(card);
      expect(mockNavigate).toHaveBeenCalledWith('/agents');
    });

    it('should navigate to /operations?chat=open when Operations Manager card is clicked', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);
      const card = screen.getByText('Operations Manager').closest('div.bg-card')!;
      await user.click(card);
      expect(mockNavigate).toHaveBeenCalledWith('/operations?chat=open');
    });
  });

  describe('loading state', () => {
    beforeEach(() => {
      mockUseOperations.mockReturnValue({
        operations: [],
        loading: true,
        error: null,
        refetch: vi.fn(),
      } as any);
      mockUseTargets.mockReturnValue({
        targets: [],
        loading: true,
        error: null,
        refetch: vi.fn(),
      } as any);
      mockUseVulnerabilities.mockReturnValue({
        vulnerabilities: [],
        loading: true,
        error: null,
        refetch: vi.fn(),
      } as any);
      mockUseAgents.mockReturnValue({
        agents: [],
        loading: true,
        error: null,
        refetch: vi.fn(),
      } as any);
      mockUseReporterAgents.mockReturnValue({
        agents: [],
        loading: true,
      } as any);
    });

    it('should show skeleton placeholders when loading', () => {
      const { container } = render(<Dashboard />);
      const skeletons = container.querySelectorAll('[aria-busy="true"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('error state', () => {
    beforeEach(() => {
      mockUseOperations.mockReturnValue({
        operations: [],
        loading: false,
        error: 'Connection refused',
        refetch: vi.fn(),
      } as any);
    });

    it('should display error alert when a hook returns an error', () => {
      render(<Dashboard />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Failed to load some dashboard data/)).toBeInTheDocument();
    });

    it('should display the error message text', () => {
      render(<Dashboard />);
      expect(screen.getByText(/Connection refused/)).toBeInTheDocument();
    });
  });

  describe('workflow sections', () => {
    it('should show empty state when no active workflows', () => {
      render(<Dashboard />);
      expect(screen.getByText('No active workflows')).toBeInTheDocument();
    });

    it('should render Active Workflows section header', () => {
      render(<Dashboard />);
      expect(screen.getByText('Active Workflows')).toBeInTheDocument();
    });
  });
});
