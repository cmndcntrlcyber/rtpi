import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDockerExec = vi.fn();
const mockDockerExecWithRetry = vi.fn();
vi.mock('../../../server/services/docker-executor', () => ({
  dockerExecutor: {
    exec: (...args: any[]) => mockDockerExec(...args),
    execWithRetry: (...args: any[]) => mockDockerExecWithRetry(...args),
  },
  keepDatabaseAlive: vi.fn().mockResolvedValue(vi.fn()),
}));

const mockDbInsertReturning = vi.fn().mockResolvedValue([{ id: 'scan-1' }]);
const mockDbInsertOnConflict = vi.fn().mockReturnValue({ returning: mockDbInsertReturning });
const mockDbInsertValues = vi.fn().mockReturnValue({
  returning: mockDbInsertReturning,
  onConflictDoUpdate: mockDbInsertOnConflict,
  onConflictDoNothing: vi.fn().mockReturnValue({ returning: mockDbInsertReturning }),
});
const mockDbInsert = vi.fn().mockReturnValue({ values: mockDbInsertValues });

const mockDbUpdateSetWhere = vi.fn().mockResolvedValue(undefined);
const mockDbUpdateSet = vi.fn().mockReturnValue({ where: mockDbUpdateSetWhere });
const mockDbUpdate = vi.fn().mockReturnValue({ set: mockDbUpdateSet });

const mockDbSelectFromWhere = vi.fn().mockResolvedValue([]);
const mockDbSelectFrom = vi.fn().mockReturnValue({ where: mockDbSelectFromWhere });
const mockDbSelect = vi.fn().mockReturnValue({ from: mockDbSelectFrom });

vi.mock('../../../server/db', () => ({
  db: {
    insert: (...args: any[]) => mockDbInsert(...args),
    update: (...args: any[]) => mockDbUpdate(...args),
    select: (...args: any[]) => mockDbSelect(...args),
  },
}));

vi.mock('../../../server/services/workflow-event-handlers', () => ({
  workflowEventHandlers: {
    handleScanCompleted: vi.fn().mockResolvedValue(undefined),
    emit: vi.fn(),
  },
}));

vi.mock('../../../server/auth/middleware', () => ({
  logToolAudit: vi.fn(),
}));

vi.mock('../../../server/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}));

vi.mock('../../../server/lib/metrics', () => ({
  scanDuration: { observe: vi.fn() },
  toolExecutionsTotal: { inc: vi.fn() },
}));

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 50));

let nmapExecutor: any;

beforeEach(async () => {
  vi.clearAllMocks();
  mockDbInsert.mockReturnValue({ values: mockDbInsertValues });
  mockDbInsertValues.mockReturnValue({
    returning: mockDbInsertReturning,
    onConflictDoUpdate: mockDbInsertOnConflict,
    onConflictDoNothing: vi.fn().mockReturnValue({ returning: mockDbInsertReturning }),
  });
  mockDbInsertReturning.mockResolvedValue([{ id: 'scan-1', startedAt: new Date() }]);
  mockDbUpdate.mockReturnValue({ set: mockDbUpdateSet });
  mockDbUpdateSet.mockReturnValue({ where: mockDbUpdateSetWhere });
  mockDbSelect.mockReturnValue({ from: mockDbSelectFrom });
  mockDbSelectFrom.mockReturnValue({ where: mockDbSelectFromWhere });

  const mod = await import('../../../server/services/nmap-executor');
  nmapExecutor = mod.nmapExecutor;
});

describe('NmapExecutor', () => {
  describe('parseXmlOutput', () => {
    const SAMPLE_XML = `<?xml version="1.0"?>
<nmaprun scanner="nmap" args="nmap -Pn -sV -T4 -p 1-1024 -oX - 192.168.1.1">
  <host>
    <status state="up"/>
    <address addr="192.168.1.1" addrtype="ipv4"/>
    <hostnames>
      <hostname name="target.local" type="PTR"/>
    </hostnames>
    <ports>
      <port protocol="tcp" portid="22">
        <state state="open"/>
        <service name="ssh" product="OpenSSH" version="8.9p1"/>
      </port>
      <port protocol="tcp" portid="80">
        <state state="open"/>
        <service name="http" product="nginx" version="1.18.0"/>
      </port>
      <port protocol="tcp" portid="443">
        <state state="filtered"/>
        <service name="https"/>
      </port>
    </ports>
  </host>
</nmaprun>`;

    it('should parse valid XML into structured hosts', () => {
      const result = nmapExecutor.parseXmlOutput(SAMPLE_XML);
      expect(result.hosts).toHaveLength(1);
      expect(result.hosts[0].ip).toBe('192.168.1.1');
      expect(result.hosts[0].hostname).toBe('target.local');
      expect(result.hosts[0].status).toBe('up');
    });

    it('should parse port information correctly', () => {
      const result = nmapExecutor.parseXmlOutput(SAMPLE_XML);
      const ports = result.hosts[0].ports;

      expect(ports).toHaveLength(3);
      expect(ports[0]).toEqual(expect.objectContaining({
        port: 22,
        protocol: 'tcp',
        state: 'open',
        service: 'ssh',
      }));
      expect(ports[1]).toEqual(expect.objectContaining({
        port: 80,
        protocol: 'tcp',
        state: 'open',
        service: 'http',
      }));
    });

    it('should extract version and banner from service detection', () => {
      const result = nmapExecutor.parseXmlOutput(SAMPLE_XML);
      const sshPort = result.hosts[0].ports[0];

      expect(sshPort.version).toBe('8.9p1');
      expect(sshPort.banner).toBe('OpenSSH 8.9p1');
    });

    it('should return empty hosts for non-XML output', () => {
      const result = nmapExecutor.parseXmlOutput('Starting Nmap 7.94...\nNo hosts found');
      expect(result.hosts).toHaveLength(0);
      expect(result.raw).toContain('No hosts found');
    });

    it('should handle multiple hosts', () => {
      const multiHostXml = `<?xml version="1.0"?>
<nmaprun scanner="nmap">
  <host>
    <status state="up"/>
    <address addr="10.0.0.1" addrtype="ipv4"/>
    <ports><port protocol="tcp" portid="22"><state state="open"/><service name="ssh"/></port></ports>
  </host>
  <host>
    <status state="up"/>
    <address addr="10.0.0.2" addrtype="ipv4"/>
    <ports><port protocol="tcp" portid="80"><state state="open"/><service name="http"/></port></ports>
  </host>
</nmaprun>`;

      const result = nmapExecutor.parseXmlOutput(multiHostXml);
      expect(result.hosts).toHaveLength(2);
      expect(result.hosts[0].ip).toBe('10.0.0.1');
      expect(result.hosts[1].ip).toBe('10.0.0.2');
    });

    it('should handle host with no ports', () => {
      const noPortsXml = `<?xml version="1.0"?>
<nmaprun scanner="nmap">
  <host>
    <status state="up"/>
    <address addr="10.0.0.1" addrtype="ipv4"/>
  </host>
</nmaprun>`;

      const result = nmapExecutor.parseXmlOutput(noPortsXml);
      expect(result.hosts).toHaveLength(1);
      expect(result.hosts[0].ports).toHaveLength(0);
    });

    it('should extract OS match when present', () => {
      const osXml = `<?xml version="1.0"?>
<nmaprun scanner="nmap">
  <host>
    <status state="up"/>
    <address addr="10.0.0.1" addrtype="ipv4"/>
    <os><osmatch name="Linux 5.4" accuracy="95"/></os>
  </host>
</nmaprun>`;

      const result = nmapExecutor.parseXmlOutput(osXml);
      expect(result.hosts[0].os).toBe('Linux 5.4');
    });
  });

  describe('startScan', () => {
    it('should create a scan record and return scanId', async () => {
      mockDockerExecWithRetry.mockResolvedValue({ exitCode: 0, stdout: '<?xml version="1.0"?><nmaprun></nmaprun>', stderr: '' });

      const result = await nmapExecutor.startScan(
        ['192.168.1.1'],
        { ports: '1-1024' },
        'op-1',
        'user-1'
      );

      expect(result.scanId).toBe('scan-1');
      expect(mockDbInsert).toHaveBeenCalled();
    });
  });
});
