import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ContainerCard from "@/components/infrastructure/ContainerCard";
import EmpireTab from "@/components/empire/EmpireTab";

export default function Infrastructure() {
  // Mock data for containers
  const containers = [
    {
      id: "1",
      name: "rtpi-database",
      image: "postgres:16-alpine",
      status: "Up 2 hours",
      state: "running",
      ports: ["5432:5432"],
      created: "2025-01-01T10:00:00Z",
    },
    {
      id: "2",
      name: "rtpi-redis",
      image: "redis:7-alpine",
      status: "Up 2 hours",
      state: "running",
      ports: ["6379:6379"],
      created: "2025-01-01T10:00:00Z",
    },
    {
      id: "3",
      name: "rtpi-empire",
      image: "bcsecurity/empire:latest",
      status: "Exited",
      state: "stopped",
      ports: ["1337:1337"],
      created: "2025-01-01T10:00:00Z",
    },
  ];

  const devices = [
    {
      id: "1",
      hostname: "attack-workstation",
      ipAddress: "192.168.1.50",
      macAddress: "00:11:22:33:44:55",
      osType: "Linux",
      status: "online",
      lastSeen: "2025-01-15T12:00:00Z",
    },
  ];

  const healthChecks = [
    {
      id: "1",
      name: "API Health",
      type: "http",
      status: "healthy",
      endpoint: "/api/v1/health",
      lastCheck: "2025-01-15T12:00:00Z",
      message: "All systems operational",
    },
    {
      id: "2",
      name: "Database Connection",
      type: "database",
      status: "healthy",
      lastCheck: "2025-01-15T12:00:00Z",
      message: "Connected",
    },
  ];

  const handleStartContainer = (container: any) => {
    console.log("Start container:", container);
  };

  const handleStopContainer = (container: any) => {
    console.log("Stop container:", container);
  };

  const handleRestartContainer = (container: any) => {
    console.log("Restart container:", container);
  };

  // Stats
  const stats = {
    containers: containers.length,
    running: containers.filter((c) => c.state === "running").length,
    devices: devices.length,
    healthChecks: healthChecks.filter((h) => h.status === "healthy").length,
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Infrastructure Monitoring</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Containers</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.containers}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Running</h3>
          <p className="text-3xl font-bold text-green-600">{stats.running}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Devices</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.devices}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Health Checks</h3>
          <p className="text-3xl font-bold text-green-600">{stats.healthChecks}</p>
        </div>
      </div>

      {/* Tabs for different infrastructure views */}
      <Tabs defaultValue="containers" className="space-y-6">
        <TabsList>
          <TabsTrigger value="containers">Containers</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="health">Health Checks</TabsTrigger>
          <TabsTrigger value="empire">Empire C2</TabsTrigger>
        </TabsList>

        <TabsContent value="containers" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {containers.map((container) => (
              <ContainerCard
                key={container.id}
                container={container}
                onStart={handleStartContainer}
                onStop={handleStopContainer}
                onRestart={handleRestartContainer}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="devices" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {devices.map((device) => (
              <div key={device.id} className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900">{device.hostname}</h3>
                <p className="text-sm text-gray-500">{device.ipAddress}</p>
                <div className="mt-2 text-xs text-gray-500">
                  {device.osType} - {device.status}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {healthChecks.map((check) => (
              <div key={check.id} className="bg-white p-6 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{check.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded ${
                    check.status === "healthy" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>
                    {check.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{check.message}</p>
                <p className="text-xs text-gray-400 mt-2">
                  Last check: {new Date(check.lastCheck).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="empire" className="space-y-4">
          <EmpireTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
