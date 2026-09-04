export interface AgentPersona {
  agentType: string;
  displayName: string;
  methodology: string;
  expertiseDomains: string[];
  behavioralConstraints: {
    maxRiskTolerance: "low" | "medium" | "high";
    requiresApprovalFor: string[];
    prohibitedActions: string[];
  };
}

export interface PersonaPerformance {
  tasksCompleted: number;
  avgIterations: number;
  successRate: number;
  avgFindingsPerTask: number;
  lastUpdated: string;
}

export interface TaskPerformanceUpdate {
  iterations: number;
  findingsCount: number;
  success: boolean;
}
