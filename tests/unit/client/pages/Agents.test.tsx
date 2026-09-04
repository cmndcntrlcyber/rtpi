import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/hooks/useAgents', () => ({
  useAgents: vi.fn(),
}));

vi.mock('@/hooks/useMCPServers', () => ({
  useMCPServers: vi.fn(),
}));

vi.mock('@/hooks/useTargets', () => ({
  useTargets: () => ({
    targets: [{ id: 't-1', value: '192.168.1.1' }],
    loading: false,
  }),
}));

vi.mock('@/hooks/useOperations', () => ({
  useOperations: () => ({
    operations: [{ id: 'op-1', name: 'Test', status: 'active' }],
    loading: false,
  }),
}));

vi.mock('@/hooks/useTools', () => ({
  useTools: () => ({
    tools: [],
    loading: false,
  }),
}));

vi.mock('@/hooks/useWorkflows', () => ({
  useWorkflows: () => ({
    runningWorkflows: [],
    allNonRunning: [],
    getWorkflowDetails: vi.fn(),
    cancelWorkflow: vi.fn(),
    connected: false,
    workflowEventTick: 0,
  }),
}));

vi.mock('@/hooks/useWorkflowTemplates', () => ({
  useWorkflowTemplates: () => ({
    templates: [],
    loading: false,
    reorder: vi.fn(),
    refetch: vi.fn(),
  }),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('@/contexts/AgentChatContext', () => ({
  useAgentChatManager: () => ({
    openAgentChat: vi.fn(),
  }),
}));

vi.mock('@/components/agents/WorkflowProgressCard', () => ({
  default: () => <div>WorkflowProgress</div>,
}));

vi.mock('@/components/agents/WorkflowDetailsDialog', () => ({
  default: () => null,
}));

vi.mock('@/components/agents/ImportAgentDialog', () => ({
  default: () => null,
}));

vi.mock('@/components/agents/RestoreBackupsDialog', () => ({
  RestoreBackupsDialog: () => null,
}));

vi.mock('@/components/agents/WorkflowBuilder', () => ({
  default: () => <div data-testid="workflow-builder">Builder</div>,
}));

vi.mock('@/components/agents/WorkflowEditDialog', () => ({
  default: () => null,
}));

vi.mock('@/components/agents/AgentsTablePanel', () => ({
  AgentsTablePanel: ({ agents }: any) => (
    <div data-testid="agents-table">
      {agents?.map((a: any) => <div key={a.id}>{a.name}</div>)}
    </div>
  ),
}));

vi.mock('@/components/mcp/DefaultServersPanel', () => ({
  DefaultServersPanel: () => <div data-testid="mcp-panel">MCP Default Servers</div>,
}));

vi.mock('@/components/flows/AgentFlowCanvas', () => ({
  default: () => <div>FlowCanvas</div>,
}));

vi.mock('@/components/flows/AgentMcpPanel', () => ({
  default: () => <div>AgentMcpPanel</div>,
}));

vi.mock('@/components/ui/DualListbox', () => ({
  DualListbox: () => <div>DualListbox</div>,
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
    isDragging: false,
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return {
    ...actual,
    createPortal: (children: any) => children,
  };
});

import { useAgents } from '@/hooks/useAgents';
import { useMCPServers } from '@/hooks/useMCPServers';

const mockUseAgents = vi.mocked(useAgents);
const mockUseMCPServers = vi.mocked(useMCPServers);

function setDefaultHooks() {
  mockUseAgents.mockReturnValue({
    agents: [
      { id: 'a-1', name: 'Recon Agent', type: 'anthropic', status: 'running', config: {} },
      { id: 'a-2', name: 'Exploit Agent', type: 'openai', status: 'idle', config: {} },
    ],
    loading: false,
    error: null,
    refetch: vi.fn(),
  } as any);
  mockUseMCPServers.mockReturnValue({
    servers: [
      { id: 's-1', name: 'File Server', status: 'running' },
    ],
    loading: false,
    refetch: vi.fn(),
  } as any);
}

describe('Agents Page', () => {
  let Agents: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    setDefaultHooks();
    const mod = await import('../../../../client/src/pages/Agents');
    Agents = mod.default;
  });

  describe('with data', () => {
    it('should render the page header', () => {
      render(<Agents />);
      expect(screen.getAllByText('AI Agents & MCP Servers').length).toBeGreaterThan(0);
    });

    it('should display AI Agents stat card', () => {
      render(<Agents />);
      expect(screen.getAllByText('AI Agents').length).toBeGreaterThan(0);
    });

    it('should display MCP Servers stat card', () => {
      render(<Agents />);
      expect(screen.getAllByText('MCP Servers').length).toBeGreaterThan(0);
    });

    it('should display Active Agents stat card', () => {
      render(<Agents />);
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('should display Connected stat card', () => {
      render(<Agents />);
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  describe('stat card values', () => {
    it('should display correct AI Agents count', () => {
      const { container } = render(<Agents />);
      const statCards = container.querySelectorAll('div.bg-card');
      const agentsCard = Array.from(statCards).find(c =>
        c.querySelector('h3')?.textContent === 'AI Agents'
      );
      expect(agentsCard).toHaveTextContent('2');
    });

    it('should display correct Active Agents count (filtered by status=running)', () => {
      const { container } = render(<Agents />);
      const statCards = container.querySelectorAll('div.bg-card');
      const activeCard = Array.from(statCards).find(c =>
        c.querySelector('h3')?.textContent === 'Active Agents'
      );
      expect(activeCard).toHaveTextContent('1');
    });

    it('should display correct MCP Servers count', () => {
      const { container } = render(<Agents />);
      const statCards = container.querySelectorAll('div.bg-card');
      const mcpCard = Array.from(statCards).find(c =>
        c.querySelector('h3')?.textContent === 'MCP Servers'
      );
      expect(mcpCard).toHaveTextContent('1');
    });

    it('should display correct Connected count (running servers)', () => {
      const { container } = render(<Agents />);
      const statCards = container.querySelectorAll('div.bg-card');
      const connectedCard = Array.from(statCards).find(c =>
        c.querySelector('h3')?.textContent === 'Connected'
      );
      expect(connectedCard).toHaveTextContent('1');
    });
  });

  describe('loading state', () => {
    beforeEach(() => {
      mockUseAgents.mockReturnValue({
        agents: [],
        loading: true,
        error: null,
        refetch: vi.fn(),
      } as any);
      mockUseMCPServers.mockReturnValue({
        servers: [],
        loading: true,
        refetch: vi.fn(),
      } as any);
    });

    it('should show skeleton placeholders when loading', () => {
      const { container } = render(<Agents />);
      const skeletons = container.querySelectorAll('[aria-busy="true"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('tab switching', () => {
    it('should show AI Agents tab content by default', () => {
      render(<Agents />);
      expect(screen.getByTestId('agents-table')).toBeInTheDocument();
    });

    it('should render agent names in the agents table', () => {
      render(<Agents />);
      expect(screen.getByText('Recon Agent')).toBeInTheDocument();
      expect(screen.getByText('Exploit Agent')).toBeInTheDocument();
    });

    it('should switch to MCP Servers tab when clicked', async () => {
      const user = userEvent.setup();
      render(<Agents />);
      const mcpTab = screen.getByRole('tab', { name: 'MCP Servers' });
      await user.click(mcpTab);
      expect(screen.getByTestId('mcp-panel')).toBeInTheDocument();
    });
  });
});
