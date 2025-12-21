import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Target, Users, Wrench, ShieldCheck, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import TechniquesTable from "@/components/attack/TechniquesTable";
import TacticsGrid from "@/components/attack/TacticsGrid";
import StixImportDialog from "@/components/attack/StixImportDialog";

interface AttackStats {
  techniques: number;
  subtechniques: number;
  tactics: number;
  groups: number;
  software: number;
  mitigations: number;
  dataSources: number;
  campaigns: number;
}

export default function AttackFramework() {
  const [stats, setStats] = useState<AttackStats>({
    techniques: 0,
    subtechniques: 0,
    tactics: 0,
    groups: 0,
    software: 0,
    mitigations: 0,
    dataSources: 0,
    campaigns: 0,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/v1/attack/stats", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch ATT&CK statistics",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
      toast({
        title: "Error",
        description: "Failed to fetch ATT&CK statistics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const totalTechniques = stats.techniques + stats.subtechniques;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">MITRE ATT&CK Framework</h1>
            <p className="text-muted-foreground mt-1">
              Adversary tactics, techniques, and knowledge base
            </p>
          </div>
        </div>
        <StixImportDialog />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-medium text-gray-500">Techniques</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {loading ? "..." : totalTechniques.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {stats.techniques} base + {stats.subtechniques} sub
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-purple-600" />
            <h3 className="text-sm font-medium text-gray-500">Tactics</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {loading ? "..." : stats.tactics}
          </p>
          <p className="text-xs text-gray-500 mt-1">Kill chain phases</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-5 w-5 text-red-600" />
            <h3 className="text-sm font-medium text-gray-500">Groups</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {loading ? "..." : stats.groups}
          </p>
          <p className="text-xs text-gray-500 mt-1">Threat actors</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="h-5 w-5 text-orange-600" />
            <h3 className="text-sm font-medium text-gray-500">Software</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {loading ? "..." : stats.software}
          </p>
          <p className="text-xs text-gray-500 mt-1">Malware & tools</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            <h3 className="text-sm font-medium text-gray-500">Mitigations</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {loading ? "..." : stats.mitigations}
          </p>
          <p className="text-xs text-gray-500 mt-1">Countermeasures</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Database className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-medium text-gray-500">Data Sources</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {loading ? "..." : stats.dataSources}
          </p>
          <p className="text-xs text-gray-500 mt-1">Detection sources</p>
        </div>
      </div>

      {/* ATT&CK Tabs */}
      <Tabs defaultValue="techniques" className="space-y-6">
        <TabsList>
          <TabsTrigger value="techniques">Techniques</TabsTrigger>
          <TabsTrigger value="tactics">Tactics</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
          <TabsTrigger value="software">Software</TabsTrigger>
          <TabsTrigger value="mitigations">Mitigations</TabsTrigger>
          <TabsTrigger value="coverage">Coverage Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="techniques" className="space-y-4">
          <TechniquesTable />
        </TabsContent>

        <TabsContent value="tactics" className="space-y-4">
          <TacticsGrid />
        </TabsContent>

        <TabsContent value="groups" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Threat Actor Groups</h3>
            <div className="text-sm text-muted-foreground">
              Showing 0 groups
            </div>
          </div>

          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No threat groups loaded</p>
            <p className="text-sm text-gray-400 mt-2">
              Known threat actor groups tracked by MITRE ATT&CK
            </p>
          </div>
        </TabsContent>

        <TabsContent value="software" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Malware & Tools</h3>
            <div className="text-sm text-muted-foreground">
              Showing 0 software
            </div>
          </div>

          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <Wrench className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No software loaded</p>
            <p className="text-sm text-gray-400 mt-2">
              Malware and tools used by threat actors
            </p>
          </div>
        </TabsContent>

        <TabsContent value="mitigations" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Security Mitigations</h3>
            <div className="text-sm text-muted-foreground">
              Showing 0 mitigations
            </div>
          </div>

          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <ShieldCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No mitigations loaded</p>
            <p className="text-sm text-gray-400 mt-2">
              Security controls to prevent or detect techniques
            </p>
          </div>
        </TabsContent>

        <TabsContent value="coverage" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Technique Coverage Matrix</h3>
            <div className="text-sm text-muted-foreground">
              Operation technique mapping
            </div>
          </div>

          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No coverage data</p>
            <p className="text-sm text-gray-400 mt-2">
              Map operations to ATT&CK techniques to track coverage
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
