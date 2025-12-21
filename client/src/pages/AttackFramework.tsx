import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Target, Users, Wrench, ShieldCheck, Database } from "lucide-react";

export default function AttackFramework() {
  // Stats for the overview
  const stats = {
    techniques: 0,
    tactics: 0,
    groups: 0,
    software: 0,
    mitigations: 0,
    coverage: 0,
  };

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">MITRE ATT&CK Framework</h1>
          <p className="text-muted-foreground mt-1">
            Adversary tactics, techniques, and knowledge base
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-medium text-gray-500">Techniques</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.techniques}</p>
          <p className="text-xs text-gray-500 mt-1">Enterprise ATT&CK</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-purple-600" />
            <h3 className="text-sm font-medium text-gray-500">Tactics</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.tactics}</p>
          <p className="text-xs text-gray-500 mt-1">Kill chain phases</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-5 w-5 text-red-600" />
            <h3 className="text-sm font-medium text-gray-500">Groups</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.groups}</p>
          <p className="text-xs text-gray-500 mt-1">Threat actors</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="h-5 w-5 text-orange-600" />
            <h3 className="text-sm font-medium text-gray-500">Software</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.software}</p>
          <p className="text-xs text-gray-500 mt-1">Malware & tools</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            <h3 className="text-sm font-medium text-gray-500">Mitigations</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.mitigations}</p>
          <p className="text-xs text-gray-500 mt-1">Countermeasures</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Database className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-medium text-gray-500">Coverage</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.coverage}%</p>
          <p className="text-xs text-gray-500 mt-1">Operation mapping</p>
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
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">ATT&CK Techniques</h3>
            <div className="text-sm text-muted-foreground">
              Showing 0 techniques
            </div>
          </div>

          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No techniques loaded</p>
            <p className="text-sm text-gray-400 mt-2">
              Import STIX data from MITRE ATT&CK to populate techniques
            </p>
          </div>
        </TabsContent>

        <TabsContent value="tactics" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">ATT&CK Tactics</h3>
            <div className="text-sm text-muted-foreground">
              Showing 0 tactics
            </div>
          </div>

          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No tactics loaded</p>
            <p className="text-sm text-gray-400 mt-2">
              Tactics represent the "why" of an ATT&CK technique
            </p>
          </div>
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
