import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ListTodo, Trash2, Workflow } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import MarkdownEditor from "@/components/markdown/MarkdownEditor";
import DynamicFieldList from "@/components/shared/DynamicFieldList";
import QuestionResponseTable, { QuestionResponseRow } from "@/components/shared/QuestionResponseTable";
import LinkedTargets from "./LinkedTargets";
import CompletedWorkflows from "./CompletedWorkflows";
import { useWorkflowTemplates } from "@/hooks/useWorkflowTemplates";

interface OperationFormData {
  name: string;
  description?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  objectives?: string;
  scope?: string;
  applicationOverview?: Record<string, string>;
  businessImpact?: Record<string, string>;
  scopeData?: Record<string, string>;
  authentication?: Record<string, string>;
  additionalInfo?: string;
  metadata?: any;
}

interface OperationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: OperationFormData) => Promise<void>;
  initialData?: Partial<OperationFormData>;
  mode?: "create" | "edit";
  onDelete?: (id: string) => void;
  onViewTargets?: (operationId: string) => void;
  onAddTarget?: (operationId: string) => void;
}

// Define table structures based on the document
const applicationOverviewRows: QuestionResponseRow[] = [
  { question: "Application Type", field: "applicationType", type: "text", placeholder: "Standard Web App and Supporting API" },
  { question: "In-Scope Domain(s)", field: "inScopeDomains", type: "textarea", placeholder: "dev-platform.example.com..." },
  { question: "Tester Account", field: "testerAccount", type: "text", placeholder: "Security Admin, Organization Admin..." },
  { question: "Relevant Department", field: "relevantDept", type: "text", placeholder: "Customer Centric App" },
  { question: "User Base", field: "userBase", type: "text", placeholder: "50,000 - 100,000" },
  { question: "Use Cases (Services)", field: "useCases", type: "text", placeholder: "Medical Submission and Billing" },
  { question: "Brief Application Description", field: "briefDescription", type: "textarea" },
];

const businessImpactRows: QuestionResponseRow[] = [
  { question: "Employee Impact", field: "employeeImpact", type: "select", options: ["High", "Medium", "Low", "N/A"] },
  { question: "Customer Impact", field: "customerImpact", type: "select", options: ["High", "Medium", "Low", "N/A"] },
  { question: "Financial Impact", field: "financialImpact", type: "select", options: ["High", "Medium", "Low", "N/A"] },
  { question: "Resource Impact", field: "resourceImpact", type: "select", options: ["High", "Medium", "Low", "N/A"] },
];

const scopeDataRows: QuestionResponseRow[] = [
  { question: "Asset URL in scope for testing?", field: "assetUrlInScope", type: "textarea" },
  { question: "Asset URL out of scope for testing?", field: "assetUrlOutScope", type: "textarea" },
  { question: "Any upcoming changes might impact the test?", field: "upcomingChanges", type: "select", options: ["Yes", "No", "N/A"] },
  { question: "Identify and assess potential negative impacts", field: "negativeImpacts", type: "textarea" },
];

const authenticationRows: QuestionResponseRow[] = [
  { question: "Does the application use MFA, OTP, or CAPTCHA?", field: "usesMFA", type: "text" },
  { question: "Does the application use self-registration?", field: "usesSignup", type: "text" },
  { question: "Does your application use NTLM Authentication?", field: "usesNTLM", type: "select", options: ["Yes", "No", "N/A"] },
  { question: "Is VPN required for this application?", field: "requiresVPN", type: "select", options: ["Yes", "No", "N/A"] },
];

export default function OperationForm({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  mode = "create",
  onDelete,
  onViewTargets,
  onAddTarget,
}: OperationFormProps) {
  const [formData, setFormData] = useState<OperationFormData>({
    name: "",
    description: "",
    status: "planning",
    objectives: "",
    scope: "",
    applicationOverview: {},
    businessImpact: {},
    scopeData: {},
    authentication: {},
    additionalInfo: "",
  });
  const [goals, setGoals] = useState<string[]>([""]);
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { templates: workflowTemplates } = useWorkflowTemplates();

  // FIX BUG #1 CONTINUED: Helper to format ISO datetime to yyyy-MM-dd for date inputs
  const formatDateForInput = (isoDate: string | undefined): string => {
    if (!isoDate) return "";
    try {
      const date = new Date(isoDate);
      if (isNaN(date.getTime())) return "";
      return date.toISOString().split('T')[0]; // Returns yyyy-MM-dd
    } catch {
      return "";
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      status: "planning",
      objectives: "",
      scope: "",
      applicationOverview: {},
      businessImpact: {},
      scopeData: {},
      authentication: {},
      additionalInfo: "",
    });
    setGoals([""]);
    setSelectedWorkflowIds([]);
    setError("");
  };

  // Reset form when dialog closes (and not editing)
  useEffect(() => {
    if (!open && !initialData) {
      resetForm();
    }
  }, [open, initialData]);

  // Load initial data when editing
  useEffect(() => {
    if (initialData && open) {
      setFormData({
        name: initialData.name || "",
        description: initialData.description || "",
        status: initialData.status || "planning",
        // FIX BUG #1 CONTINUED: Convert ISO datetime to yyyy-MM-dd format for date inputs
        startDate: formatDateForInput(initialData.startDate),
        endDate: formatDateForInput(initialData.endDate),
        objectives: initialData.objectives || "",
        scope: initialData.scope || "",
        // Load table data from metadata (where it's actually stored)
        applicationOverview: initialData.metadata?.applicationOverview || {},
        businessImpact: initialData.metadata?.businessImpact || {},
        scopeData: initialData.metadata?.scopeData || {},
        authentication: initialData.metadata?.authentication || {},
        additionalInfo: initialData.metadata?.additionalInfo || "",
      });
      
      // Parse goals if they exist in metadata
      if (initialData.metadata?.goals) {
        setGoals(initialData.metadata.goals);
      }
      // Load workflow template selections
      setSelectedWorkflowIds(initialData.metadata?.workflowTemplateIds || []);
    }
  }, [initialData, open]);

  const handleSaveAsDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    // Use "planning" status for drafts (no "draft" in enum)
    await handleSubmit(e, "planning");
  };

  const handleSubmit = async (e: React.FormEvent, forcedStatus?: string) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      // Clean up goals
      const cleanGoals = goals.filter((g) => g.trim() !== "");

      // Package metadata (includes all custom form fields)
      const metadata: Record<string, any> = {
        goals: cleanGoals,
        applicationOverview: formData.applicationOverview,
        businessImpact: formData.businessImpact,
        scopeData: formData.scopeData,
        authentication: formData.authentication,
        additionalInfo: formData.additionalInfo,
      };
      if (selectedWorkflowIds.length > 0) {
        metadata.workflowTemplateIds = selectedWorkflowIds;
      }

      // Build submitData explicitly (avoid spread operator conflicts)
      const submitData: any = {
        name: formData.name,
        status: forcedStatus || formData.status,
      };

      // Add optional fields only if they have values
      if (formData.description) submitData.description = formData.description;
      if (formData.objectives) submitData.objectives = formData.objectives;
      if (formData.scope) submitData.scope = formData.scope;
      
      // FIX BUG #1: Send ISO strings instead of Date objects
      // JSON.stringify will properly serialize these, avoiding "toISOString is not a function" errors
      if (formData.startDate) {
        submitData.startDate = `${formData.startDate}T00:00:00.000Z`;
      }
      if (formData.endDate) {
        submitData.endDate = `${formData.endDate}T23:59:59.999Z`;
      }
      
      // Add metadata last
      submitData.metadata = metadata;

      // Debug logging removed
      // Debug logging removed
      // Debug logging removed
      
      await onSubmit(submitData);
      
      // Reset and close on success
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to save operation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (initialData && (initialData as any).id && onDelete) {
      if (confirm("Are you sure you want to delete this operation? All linked targets and vulnerabilities will also be deleted.")) {
        onDelete((initialData as any).id);
        onOpenChange(false);
      }
    }
  };

  const updateTableValue = (table: string, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [table]: {
        ...(prev as any)[table],
        [field]: value,
      },
    }));
  };

  const isEditing = mode === "edit";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            {mode === "create" ? "Create New Operation" : "Edit Operation"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="scope">Scope & Goals</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="impact">Impact & Auth</TabsTrigger>
            </TabsList>

            {/* Tab 1: Basic Information */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="name">Operation Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Penetration Test - Q1 2025"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate || ""}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate || ""}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="description">Purpose</Label>
                <Textarea
                  id="description"
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="A PCI DSS Penetration Test is a critical component that is used to determine an organization's security posture..."
                  rows={5}
                />
              </div>
            </TabsContent>

            {/* Tab 2: Scope & Goals */}
            <TabsContent value="scope" className="space-y-4 mt-4">
              <div>
                <Label className="mb-2 block">Goals</Label>
                <DynamicFieldList
                  label="Goal"
                  values={goals}
                  onChange={setGoals}
                  placeholder="Determine the security level of the web application"
                  maxFields={10}
                />
              </div>

              <div>
                <Label className="mb-2 block">Scope</Label>
                <MarkdownEditor
                  value={formData.scope || ""}
                  onChange={(value) => setFormData({ ...formData, scope: value })}
                  placeholder="The scope of this penetration test is to determine the type and the scalability for all existing and potential vulnerabilities..."
                  rows={8}
                />
              </div>

              {/* Workflow Templates */}
              {workflowTemplates.length > 0 && (
                <div>
                  <Label className="mb-2 block flex items-center gap-2">
                    <Workflow className="h-4 w-4 text-indigo-600" />
                    Assigned Workflows
                  </Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-border rounded-lg p-2">
                    {workflowTemplates.map((wt) => (
                      <div
                        key={wt.id}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                          selectedWorkflowIds.includes(wt.id)
                            ? 'bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800'
                            : 'hover:bg-secondary'
                        }`}
                        onClick={() => {
                          setSelectedWorkflowIds((prev) =>
                            prev.includes(wt.id)
                              ? prev.filter((id) => id !== wt.id)
                              : [...prev, wt.id]
                          );
                        }}
                      >
                        <Checkbox
                          checked={selectedWorkflowIds.includes(wt.id)}
                          onCheckedChange={(checked) => {
                            setSelectedWorkflowIds((prev) =>
                              checked
                                ? [...prev, wt.id]
                                : prev.filter((id) => id !== wt.id)
                            );
                          }}
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-foreground">{wt.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({wt.configuration?.agents?.length || 0} agents)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Select workflow templates to assign to this operation
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Tab 3: Details */}
            <TabsContent value="details" className="space-y-4 mt-4">
              <div>
                <h3 className="text-sm font-semibold mb-3">Application Overview</h3>
                <QuestionResponseTable
                  rows={applicationOverviewRows}
                  values={formData.applicationOverview || {}}
                  onChange={(field, value) => updateTableValue("applicationOverview", field, value)}
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3">Scope & Data Impact</h3>
                <QuestionResponseTable
                  rows={scopeDataRows}
                  values={formData.scopeData || {}}
                  onChange={(field, value) => updateTableValue("scopeData", field, value)}
                />
              </div>
            </TabsContent>

            {/* Tab 4: Impact & Authentication */}
            <TabsContent value="impact" className="space-y-4 mt-4">
              <div>
                <h3 className="text-sm font-semibold mb-3">Business Impact Analysis</h3>
                <QuestionResponseTable
                  rows={businessImpactRows}
                  values={formData.businessImpact || {}}
                  onChange={(field, value) => updateTableValue("businessImpact", field, value)}
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3">Authentication</h3>
                <QuestionResponseTable
                  rows={authenticationRows}
                  values={formData.authentication || {}}
                  onChange={(field, value) => updateTableValue("authentication", field, value)}
                />
              </div>

              <div>
                <Label htmlFor="additionalInfo">Additional Information</Label>
                <Textarea
                  id="additionalInfo"
                  value={formData.additionalInfo || ""}
                  onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
                  placeholder="Any additional information or notes..."
                  rows={4}
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Linked Targets & Workflows Section (only for existing operations) */}
          {isEditing && (initialData as any)?.id && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <LinkedTargets
                operationId={(initialData as any).id}
                onViewAll={() => {
                  if (onViewTargets && (initialData as any).id) {
                    onViewTargets((initialData as any).id);
                  }
                }}
                onAddNew={() => {
                  if (onAddTarget && (initialData as any).id) {
                    onAddTarget((initialData as any).id);
                  }
                }}
              />
              
              <CompletedWorkflows
                operationId={(initialData as any).id}
              />
            </div>
          )}

          <DialogFooter className="mt-6 flex justify-between items-center">
            <div className="flex-1">
              {isEditing && onDelete && (initialData as any)?.id && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {mode === "create" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveAsDraft}
                  disabled={submitting}
                >
                  Save as Draft
                </Button>
              )}
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  if (!initialData) resetForm();
                  onOpenChange(false);
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting 
                  ? "Saving..." 
                  : mode === "create" 
                  ? "Create Operation" 
                  : "Save Changes"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
