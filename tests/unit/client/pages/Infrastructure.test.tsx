import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useInfrastructure', () => ({
  useInfrastructure: vi.fn(),
}));

vi.mock('@/components/empire/EmpireTab', () => ({
  default: () => <div data-testid="empire-tab">Empire</div>,
}));

vi.mock('@/components/kasm/WorkspaceTab', () => ({
  default: () => <div data-testid="workspace-tab">Workspaces</div>,
}));

vi.mock('@/components/deployments/DeploymentsPanel', () => ({
  default: () => <div data-testid="deployments-panel">Deployments</div>,
}));

vi.mock('@/components/c2/C2FrameworksPanel', () => ({
  default: () => <div data-testid="c2-panel">C2 Frameworks</div>,
}));

import { useInfrastructure } from '@/hooks/useInfrastructure';
const mockUseInfrastructure = vi.mocked(useInfrastructure);

describe('Infrastructure Page', () => {
  let Infrastructure: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../../../client/src/pages/Infrastructure');
    Infrastructure = mod.default;
  });

  describe('with data', () => {
    beforeEach(() => {
      mockUseInfrastructure.mockReturnValue({
        containers: [
          { container: 'rtpi-postgres', image: 'postgres:16', running: true, state: 'running', tools: ['db'], lastHealthAt: '2024-01-15T12:00:00Z', lastHealthOk: true },
          { container: 'rtpi-redis', image: 'redis:7', running: false, state: 'exited', tools: [], lastHealthAt: null, lastHealthOk: null },
        ],
        mcpServers: [
          { id: 's-1', name: 'File Server', status: 'running', lastProbeAt: '2024-01-15T12:00:00Z', lastProbeOk: true },
        ],
        devices: [
          { id: 'd-1', name: 'Workstation', deviceId: 'dev-001', ipAddress: '10.0.0.5', isBlocked: false, lastSeen: '2024-01-15T12:00:00Z' },
        ],
        healthChecks: [
          { id: 'h-1', name: 'API Health', type: 'http', status: 'healthy', endpoint: '/health', lastCheck: '2024-01-15T12:00:00Z', message: null },
          { id: 'h-2', name: 'DB Health', type: 'tcp', status: 'ok', endpoint: null, lastCheck: '2024-01-15T12:00:00Z', message: null },
        ],
        loading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
    });

    it('should render the page header', () => {
      render(<Infrastructure />);
      expect(screen.getByText('Infrastructure Monitoring')).toBeInTheDocument();
    });

    it('should render the refresh button', () => {
      render(<Infrastructure />);
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    it('should display stat cards with correct counts', () => {
      const { container } = render(<Infrastructure />);
      const statCards = container.querySelectorAll('.bg-card.p-6.rounded-lg');
      expect(statCards.length).toBe(4);

      const texts = Array.from(statCards).map((card) => card.textContent);
      expect(texts.find((t) => t?.includes('Containers'))).toContain('2');
      expect(texts.find((t) => t?.includes('Running'))).toContain('1');
      expect(texts.find((t) => t?.includes('Devices'))).toContain('1');
      expect(texts.find((t) => t?.includes('Healthy Checks'))).toContain('2');
    });

    it('should render tab triggers', () => {
      render(<Infrastructure />);
      expect(screen.getByRole('tab', { name: 'Containers' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Deployments' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Devices' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Health Checks' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'C2 Frameworks' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'C2 Warroom' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Workspaces' })).toBeInTheDocument();
    });

    it('should render container cards with names', () => {
      render(<Infrastructure />);
      expect(screen.getByText('rtpi-postgres')).toBeInTheDocument();
      expect(screen.getByText('rtpi-redis')).toBeInTheDocument();
    });

    it('should render container state badges', () => {
      render(<Infrastructure />);
      expect(screen.getAllByText('running').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('exited')).toBeInTheDocument();
    });

    it('should render container images', () => {
      render(<Infrastructure />);
      expect(screen.getByText('postgres:16')).toBeInTheDocument();
      expect(screen.getByText('redis:7')).toBeInTheDocument();
    });

    it('should render MCP server cards', () => {
      render(<Infrastructure />);
      expect(screen.getByText('File Server')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    beforeEach(() => {
      mockUseInfrastructure.mockReturnValue({
        containers: [],
        mcpServers: [],
        devices: [],
        healthChecks: [],
        loading: true,
        error: null,
        refetch: vi.fn(),
      } as any);
    });

    it('should show loading skeletons', () => {
      const { container } = render(<Infrastructure />);
      const busyElement = container.querySelector('[aria-busy="true"]');
      expect(busyElement).toBeInTheDocument();
    });

    it('should disable refresh button when loading', () => {
      render(<Infrastructure />);
      const refreshButton = screen.getByText('Refresh').closest('button');
      expect(refreshButton).toBeDisabled();
    });
  });

  describe('empty state', () => {
    beforeEach(() => {
      mockUseInfrastructure.mockReturnValue({
        containers: [],
        mcpServers: [],
        devices: [],
        healthChecks: [],
        loading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
    });

    it('should show empty state for containers', () => {
      render(<Infrastructure />);
      expect(screen.getByText('No containers found')).toBeInTheDocument();
    });

    it('should display zero counts in stat cards', () => {
      render(<Infrastructure />);
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('error state', () => {
    beforeEach(() => {
      mockUseInfrastructure.mockReturnValue({
        containers: [],
        mcpServers: [],
        devices: [],
        healthChecks: [],
        loading: false,
        error: 'Connection refused',
        refetch: vi.fn(),
      } as any);
    });

    it('should display error banner', () => {
      render(<Infrastructure />);
      expect(screen.getByText(/Failed to load live infrastructure data/)).toBeInTheDocument();
      expect(screen.getByText(/Connection refused/)).toBeInTheDocument();
    });
  });

  describe('refresh interaction', () => {
    it('should call refetch when Refresh button is clicked', async () => {
      const mockRefetch = vi.fn();
      mockUseInfrastructure.mockReturnValue({
        containers: [
          { container: 'rtpi-postgres', image: 'postgres:16', running: true, state: 'running', tools: ['db'], lastHealthAt: '2024-01-15T12:00:00Z', lastHealthOk: true },
        ],
        mcpServers: [],
        devices: [],
        healthChecks: [],
        loading: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const user = userEvent.setup();
      render(<Infrastructure />);
      const refreshButton = screen.getByText('Refresh').closest('button')!;
      await user.click(refreshButton);
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe('tab switching', () => {
    beforeEach(() => {
      mockUseInfrastructure.mockReturnValue({
        containers: [
          { container: 'rtpi-postgres', image: 'postgres:16', running: true, state: 'running', tools: ['db'], lastHealthAt: null, lastHealthOk: null },
        ],
        mcpServers: [],
        devices: [
          { id: 'd-1', name: 'Workstation', deviceId: 'dev-001', ipAddress: '10.0.0.5', isBlocked: false, lastSeen: '2024-01-15T12:00:00Z' },
        ],
        healthChecks: [
          { id: 'h-1', name: 'API Health', type: 'http', status: 'healthy', endpoint: '/health', lastCheck: '2024-01-15T12:00:00Z', message: null },
        ],
        loading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
    });

    it('should switch to Devices tab when clicked', async () => {
      const user = userEvent.setup();
      render(<Infrastructure />);
      const devicesTab = screen.getByRole('tab', { name: 'Devices' });
      await user.click(devicesTab);
      expect(screen.getByText('Workstation')).toBeInTheDocument();
    });

    it('should switch to Health Checks tab when clicked', async () => {
      const user = userEvent.setup();
      render(<Infrastructure />);
      const healthTab = screen.getByRole('tab', { name: 'Health Checks' });
      await user.click(healthTab);
      expect(screen.getByText('API Health')).toBeInTheDocument();
    });
  });
});
