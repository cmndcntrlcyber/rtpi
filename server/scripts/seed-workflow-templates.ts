import { db } from "../db";
import { workflowTemplates } from "../../shared/schema";

/**
 * Workflow template seed data for the v2.1 Agent Framework
 *
 * These templates define the available workflows that can be executed
 * by the Dynamic Workflow Orchestrator. Each template specifies required
 * and optional capabilities, allowing the orchestrator to dynamically
 * select appropriate agents based on what's available.
 */
const workflowTemplatesData = [
  // ===== SURFACE ASSESSMENT WORKFLOW =====
  {
    name: "Surface Assessment Workflow",
    description:
      "Automated surface assessment workflow triggered on operation creation. Retrieves scope, executes BBOT reconnaissance, and documents findings.",
    triggerEvent: "operation_created",
    requiredCapabilities: ["scope_retrieval", "surface_scanning", "finding_documentation"],
    optionalCapabilities: ["tool_discovery"],
    configuration: {
      maxParallelAgents: 1,
      timeoutPerPhase: 7200000, // 2 hours
      retryPolicy: { maxRetries: 2, backoffMultiplier: 2 },
      fallbackBehavior: "skip",
      description: "Executes reconnaissance against in-scope domains using BBOT",
    },
    isActive: true,
  },

  // ===== WEB HACKER WORKFLOW =====
  {
    name: "Web Hacker Workflow",
    description:
      "Automated vulnerability validation and exploitation workflow. Triggered after surface assessment completes. Uses nuclei templates to validate findings.",
    triggerEvent: "surface_assessment_completed",
    requiredCapabilities: ["vulnerability_analysis", "nuclei_scanning"],
    optionalCapabilities: ["template_generation", "tool_selection"],
    configuration: {
      maxParallelAgents: 3,
      timeoutPerPhase: 3600000, // 1 hour
      retryPolicy: { maxRetries: 1, backoffMultiplier: 1 },
      fallbackBehavior: "skip",
      description: "Validates vulnerabilities found during surface assessment",
    },
    isActive: true,
  },

  // ===== FULL ASSESSMENT PIPELINE =====
  {
    name: "Full Assessment Pipeline",
    description:
      "Complete assessment pipeline from scope retrieval to exploitation. Combines surface assessment and web hacker workflows.",
    triggerEvent: "manual",
    requiredCapabilities: [
      "tool_discovery",
      "scope_retrieval",
      "surface_scanning",
      "finding_documentation",
      "vulnerability_analysis",
      "nuclei_scanning",
      "template_generation",
    ],
    optionalCapabilities: [],
    configuration: {
      maxParallelAgents: 2,
      timeoutPerPhase: 14400000, // 4 hours
      retryPolicy: { maxRetries: 2, backoffMultiplier: 2 },
      fallbackBehavior: "skip",
      description: "End-to-end assessment from reconnaissance to exploitation",
    },
    isActive: true,
  },

  // ===== TOOL DISCOVERY WORKFLOW =====
  {
    name: "Tool Discovery Workflow",
    description:
      "Standalone workflow for tool discovery. Polls the rtpi-tools container to update the tool registry.",
    triggerEvent: "manual",
    requiredCapabilities: ["tool_discovery", "tool_registry_sync"],
    optionalCapabilities: [],
    configuration: {
      maxParallelAgents: 1,
      timeoutPerPhase: 300000, // 5 minutes
      retryPolicy: { maxRetries: 3, backoffMultiplier: 1.5 },
      fallbackBehavior: "fail",
      description: "Discovers and syncs available security tools",
    },
    isActive: true,
  },

  // ===== VULNERABILITY VALIDATION ONLY =====
  {
    name: "Vulnerability Validation",
    description:
      "Validate specific vulnerabilities using nuclei templates. Does not require prior surface assessment.",
    triggerEvent: "manual",
    requiredCapabilities: ["nuclei_scanning"],
    optionalCapabilities: ["template_generation", "tool_selection"],
    configuration: {
      maxParallelAgents: 5,
      timeoutPerPhase: 1800000, // 30 minutes
      retryPolicy: { maxRetries: 2, backoffMultiplier: 1 },
      fallbackBehavior: "skip",
      description: "Validate vulnerabilities without full surface assessment",
    },
    isActive: true,
  },

  // ===== TEMPLATE GENERATION WORKFLOW =====
  {
    name: "Template Generation Workflow",
    description:
      "Generate custom nuclei templates for specific vulnerability types using AI.",
    triggerEvent: "manual",
    requiredCapabilities: ["template_generation"],
    optionalCapabilities: ["vulnerability_analysis"],
    configuration: {
      maxParallelAgents: 1,
      timeoutPerPhase: 600000, // 10 minutes
      retryPolicy: { maxRetries: 2, backoffMultiplier: 1 },
      fallbackBehavior: "fail",
      description: "AI-powered nuclei template generation",
    },
    isActive: true,
  },

  // ===== CONTINUOUS MONITORING WORKFLOW =====
  {
    name: "Continuous Monitoring Workflow",
    description:
      "Periodic assessment workflow for ongoing operations. Runs surface assessment at scheduled intervals.",
    triggerEvent: "scheduled",
    requiredCapabilities: ["scope_retrieval", "surface_scanning"],
    optionalCapabilities: ["finding_documentation", "vulnerability_analysis"],
    configuration: {
      maxParallelAgents: 1,
      timeoutPerPhase: 3600000, // 1 hour
      retryPolicy: { maxRetries: 1, backoffMultiplier: 1 },
      fallbackBehavior: "skip",
      scheduleInterval: "0 */6 * * *", // Every 6 hours (cron format)
      description: "Continuous monitoring with periodic assessments",
    },
    isActive: false, // Disabled by default, enable when needed
  },

  // ===== QUICK SCAN WORKFLOW =====
  {
    name: "Quick Scan Workflow",
    description:
      "Lightweight reconnaissance workflow for rapid assessment. Uses minimal capabilities.",
    triggerEvent: "manual",
    requiredCapabilities: ["scope_retrieval", "surface_scanning"],
    optionalCapabilities: [],
    configuration: {
      maxParallelAgents: 1,
      timeoutPerPhase: 1800000, // 30 minutes
      retryPolicy: { maxRetries: 1, backoffMultiplier: 1 },
      fallbackBehavior: "fail",
      scanPreset: "subdomain-enum", // Override default preset
      description: "Quick reconnaissance scan with minimal overhead",
    },
    isActive: true,
  },
];

async function seedWorkflowTemplates() {
  try {
    console.log("🌱 Seeding workflow templates...");

    // Check existing templates
    const existingTemplates = await db.select().from(workflowTemplates);
    console.log(`Found ${existingTemplates.length} existing templates`);

    // Upsert templates (update if exists, insert if not)
    let inserted = 0;
    let updated = 0;

    for (const template of workflowTemplatesData) {
      const existing = existingTemplates.find((t) => t.name === template.name);

      if (existing) {
        // Update existing template
        await db
          .update(workflowTemplates)
          .set({
            description: template.description,
            triggerEvent: template.triggerEvent,
            requiredCapabilities: template.requiredCapabilities,
            optionalCapabilities: template.optionalCapabilities,
            configuration: template.configuration,
            isActive: template.isActive,
            updatedAt: new Date(),
          })
          .where(require("drizzle-orm").eq(workflowTemplates.id, existing.id));
        updated++;
        console.log(`✓ Updated: ${template.name}`);
      } else {
        // Insert new template
        await db.insert(workflowTemplates).values(template);
        inserted++;
        console.log(`✓ Added: ${template.name}`);
      }
    }

    console.log(`\n✅ Successfully seeded workflow templates!`);
    console.log(`   - Inserted: ${inserted}`);
    console.log(`   - Updated: ${updated}`);

    console.log("\nWorkflow templates by trigger event:");
    const triggers = Array.from(new Set(workflowTemplatesData.map((t) => t.triggerEvent)));
    for (const trigger of triggers) {
      const count = workflowTemplatesData.filter((t) => t.triggerEvent === trigger).length;
      console.log(`  - ${trigger}: ${count} templates`);
    }

    console.log("\nActive templates:");
    const activeTemplates = workflowTemplatesData.filter((t) => t.isActive);
    for (const template of activeTemplates) {
      console.log(`  ✓ ${template.name}`);
    }

    const inactiveTemplates = workflowTemplatesData.filter((t) => !t.isActive);
    if (inactiveTemplates.length > 0) {
      console.log("\nInactive templates (can be enabled as needed):");
      for (const template of inactiveTemplates) {
        console.log(`  ○ ${template.name}`);
      }
    }
  } catch (error) {
    console.error("❌ Error seeding workflow templates:", error);
    process.exit(1);
  }
}

// Run the seeder
seedWorkflowTemplates()
  .then(() => {
    console.log("\n🎉 Workflow template seeding complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
