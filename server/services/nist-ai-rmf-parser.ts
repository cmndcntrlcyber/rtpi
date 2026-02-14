import { db } from "../db";
import { nistAiFunctions, nistAiCategories, nistAiSubcategories } from "@shared/schema";
import { eq } from "drizzle-orm";

// Hardcoded NIST AI RMF structure (extracted from PDF)
interface NISTFunction {
  id: string;
  name: string;
  description: string;
  categories: NISTCategory[];
}

interface NISTCategory {
  id: string;
  name: string;
  description: string;
  subcategories: NISTSubcategory[];
}

interface NISTSubcategory {
  id: string;
  name: string;
  description: string;
  implementationExamples?: string[];
}

const NIST_AI_RMF_DATA: NISTFunction[] = [
  {
    id: 'GOVERN',
    name: 'Govern',
    description: 'Cultivates a culture of risk management and establishes processes for AI governance',
    categories: [
      {
        id: 'GOVERN-1',
        name: 'Accountable AI Governance',
        description: 'Legal and regulatory requirements are understood and managed',
        subcategories: [
          {
            id: 'GOVERN-1.1',
            name: 'Legal and regulatory requirements understood',
            description: 'Organizations understand applicable laws, regulations, and policies',
            implementationExamples: ['Maintain inventory of applicable regulations', 'Assign legal compliance team'],
          },
          {
            id: 'GOVERN-1.2',
            name: 'Roles and responsibilities defined',
            description: 'Organizational roles for AI risk management are defined and assigned',
            implementationExamples: ['Designate AI risk officer', 'Define RACI matrix for AI projects'],
          },
        ],
      },
      {
        id: 'GOVERN-2',
        name: 'Risk Management Process',
        description: 'Processes are in place to map, measure, and manage AI risks',
        subcategories: [
          {
            id: 'GOVERN-2.1',
            name: 'Risk management process established',
            description: 'Organization has established processes for AI risk management',
            implementationExamples: ['Create AI risk management policy', 'Implement risk assessment workflow'],
          },
        ],
      },
    ],
  },
  {
    id: 'MAP',
    name: 'Map',
    description: 'Establishes context for AI system risks',
    categories: [
      {
        id: 'MAP-1',
        name: 'Context Establishment',
        description: 'AI system context and impacts are identified',
        subcategories: [
          {
            id: 'MAP-1.1',
            name: 'System context documented',
            description: 'Purpose, use cases, and context of AI system are documented',
            implementationExamples: ['Create AI system specification', 'Document intended use cases'],
          },
          {
            id: 'MAP-1.2',
            name: 'Stakeholders identified',
            description: 'Stakeholders and their concerns are identified and documented',
            implementationExamples: ['Create stakeholder map', 'Conduct stakeholder interviews'],
          },
        ],
      },
    ],
  },
  {
    id: 'MEASURE',
    name: 'Measure',
    description: 'Employs tools, techniques, and methodologies to assess AI risks',
    categories: [
      {
        id: 'MEASURE-1',
        name: 'Risk Assessment',
        description: 'AI risks are identified, assessed, and prioritized',
        subcategories: [
          {
            id: 'MEASURE-1.1',
            name: 'Risks identified and assessed',
            description: 'AI system risks are identified and assessed using appropriate methods',
            implementationExamples: ['Conduct threat modeling', 'Perform risk assessment'],
          },
        ],
      },
    ],
  },
  {
    id: 'MANAGE',
    name: 'Manage',
    description: 'Allocates resources to manage AI risks on a regular basis',
    categories: [
      {
        id: 'MANAGE-1',
        name: 'Risk Response',
        description: 'AI risks are responded to and resources are allocated',
        subcategories: [
          {
            id: 'MANAGE-1.1',
            name: 'Risk treatment plans implemented',
            description: 'Plans to respond to identified risks are implemented',
            implementationExamples: ['Create risk treatment plan', 'Allocate budget for mitigations'],
          },
        ],
      },
    ],
  },
];

export async function importNISTAIRMF(): Promise<{ functions: number; categories: number; subcategories: number }> {
  const stats = { functions: 0, categories: 0, subcategories: 0 };

  for (const func of NIST_AI_RMF_DATA) {
    // Insert function
    const [insertedFunction] = await db.insert(nistAiFunctions).values({
      functionId: func.id,
      name: func.name,
      description: func.description,
      sortOrder: NIST_AI_RMF_DATA.indexOf(func) + 1,
    }).onConflictDoNothing().returning();

    if (insertedFunction) stats.functions++;

    // Get function ID
    const dbFunctions = await db.select().from(nistAiFunctions).where(eq(nistAiFunctions.functionId, func.id));
    const dbFunction = dbFunctions[0];

    for (const category of func.categories) {
      // Insert category
      const [insertedCategory] = await db.insert(nistAiCategories).values({
        categoryId: category.id,
        functionId: dbFunction.id,
        name: category.name,
        description: category.description,
        sortOrder: func.categories.indexOf(category) + 1,
      }).onConflictDoNothing().returning();

      if (insertedCategory) stats.categories++;

      // Get category ID
      const dbCategories = await db.select().from(nistAiCategories).where(eq(nistAiCategories.categoryId, category.id));
      const dbCategory = dbCategories[0];

      for (const subcategory of category.subcategories) {
        // Insert subcategory
        const [insertedSubcategory] = await db.insert(nistAiSubcategories).values({
          subcategoryId: subcategory.id,
          categoryId: dbCategory.id,
          name: subcategory.name,
          description: subcategory.description,
          implementationExamples: subcategory.implementationExamples || [],
          sortOrder: category.subcategories.indexOf(subcategory) + 1,
        }).onConflictDoNothing().returning();

        if (insertedSubcategory) stats.subcategories++;
      }
    }
  }

  return stats;
}

export async function getNISTAIStats() {
  const functionsCount = await db.select().from(nistAiFunctions);
  const categoriesCount = await db.select().from(nistAiCategories);
  const subcategoriesCount = await db.select().from(nistAiSubcategories);

  return {
    functions: functionsCount.length,
    categories: categoriesCount.length,
    subcategories: subcategoriesCount.length,
  };
}
