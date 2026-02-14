import { db } from "../db";
import { owaspLlmVulnerabilities, owaspLlmAttackVectors, owaspLlmMitigations } from "@shared/schema";

interface OWASPLLMVulnerability {
  id: string;          // 'LLM01', 'LLM02', etc.
  name: string;
  description: string;
  riskRating: string;
  commonExamples: string[];
  preventionStrategies: string[];
  exampleAttackScenarios: string[];
  references: string[];
  cweMappings: string[];
}

// Hardcoded OWASP LLM Top 10 data (extracted from PDF)
const OWASP_LLM_TOP_10: OWASPLLMVulnerability[] = [
  {
    id: 'LLM01',
    name: 'Prompt Injection',
    description: 'Crafted inputs manipulate a Large Language Model through prompts, causing unintended actions',
    riskRating: 'Critical',
    commonExamples: [
      'Direct prompt injection (jailbreaking)',
      'Indirect prompt injection via external sources',
      'System prompt leakage',
    ],
    preventionStrategies: [
      'Privilege control on LLM access to backend systems',
      'Human in the loop for extended functionality',
      'Segregate external content from user prompts',
      'Establish trust boundaries',
    ],
    exampleAttackScenarios: [
      'User crafts prompt to bypass content filters',
      'Malicious website contains hidden prompt that hijacks user session',
    ],
    references: [
      'https://owasp.org/www-project-top-10-for-large-language-model-applications/',
    ],
    cweMappings: ['CWE-74', 'CWE-77'],
  },
  {
    id: 'LLM02',
    name: 'Insecure Output Handling',
    description: 'Insufficient validation of LLM outputs before passing downstream',
    riskRating: 'High',
    commonExamples: [
      'LLM output directly rendered in web UI (XSS)',
      'LLM output used in SQL queries (SQLi)',
      'LLM output executed as code',
    ],
    preventionStrategies: [
      'Treat model as untrusted user input',
      'Apply input validation on outputs',
      'Encode output to prevent injection attacks',
    ],
    exampleAttackScenarios: [
      'LLM generates malicious JavaScript that executes in user browser',
      'LLM crafts SQL injection payload that leaks database',
    ],
    references: ['https://owasp.org/www-project-top-10-for-large-language-model-applications/'],
    cweMappings: ['CWE-79', 'CWE-89'],
  },
  {
    id: 'LLM03',
    name: 'Training Data Poisoning',
    description: 'Manipulation of training data to introduce vulnerabilities or biases',
    riskRating: 'High',
    commonExamples: [
      'Supply chain attack on training datasets',
      'Adversarial examples in fine-tuning data',
      'Backdoor triggers in training corpus',
    ],
    preventionStrategies: [
      'Verify supply chain for training data',
      'Use legitimate, vetted data sources',
      'Implement anomaly detection during training',
      'Adversarial robustness testing',
    ],
    exampleAttackScenarios: [
      'Attacker contributes poisoned data to open-source dataset',
      'Model trained on scraped data containing malicious content',
    ],
    references: ['https://owasp.org/www-project-top-10-for-large-language-model-applications/'],
    cweMappings: ['CWE-1419'],
  },
  {
    id: 'LLM04',
    name: 'Model Denial of Service',
    description: 'Resource exhaustion attacks against LLM inference',
    riskRating: 'Medium',
    commonExamples: [
      'High-volume requests overwhelming model',
      'Resource-intensive queries (long context windows)',
      'Recursive context expansion',
    ],
    preventionStrategies: [
      'Rate limiting per user/IP',
      'Input validation on request size',
      'Resource caps per request',
      'Queue management',
    ],
    exampleAttackScenarios: [
      'Attacker floods API with max-length prompts',
      'Crafted input causes infinite loop in processing',
    ],
    references: ['https://owasp.org/www-project-top-10-for-large-language-model-applications/'],
    cweMappings: ['CWE-400', 'CWE-920'],
  },
  {
    id: 'LLM05',
    name: 'Supply Chain Vulnerabilities',
    description: 'Risks from third-party components, datasets, or models',
    riskRating: 'High',
    commonExamples: [
      'Compromised pre-trained models',
      'Malicious plugins or extensions',
      'Vulnerable dependencies',
    ],
    preventionStrategies: [
      'Vet third-party models and datasets',
      'Use model signatures and checksums',
      'Dependency scanning',
      'Isolated execution environments',
    ],
    exampleAttackScenarios: [
      'Downloaded model contains backdoor',
      'Plugin exploits LLM API to exfiltrate data',
    ],
    references: ['https://owasp.org/www-project-top-10-for-large-language-model-applications/'],
    cweMappings: ['CWE-1357'],
  },
  {
    id: 'LLM06',
    name: 'Sensitive Information Disclosure',
    description: 'LLM reveals confidential data through responses',
    riskRating: 'High',
    commonExamples: [
      'Training data leakage in responses',
      'PII disclosure from memorized examples',
      'API keys or credentials in outputs',
    ],
    preventionStrategies: [
      'Data sanitization in training corpus',
      'Implement guardrails on outputs',
      'User awareness training',
      'Output filtering',
    ],
    exampleAttackScenarios: [
      'User prompts model to reveal training data',
      'Model generates PII from real users in training set',
    ],
    references: ['https://owasp.org/www-project-top-10-for-large-language-model-applications/'],
    cweMappings: ['CWE-200', 'CWE-359'],
  },
  {
    id: 'LLM07',
    name: 'Insecure Plugin Design',
    description: 'LLM plugins with insufficient access control',
    riskRating: 'High',
    commonExamples: [
      'Plugin accepts free-text input without validation',
      'Insufficient authorization on plugin actions',
      'Plugin exposes sensitive functions to LLM',
    ],
    preventionStrategies: [
      'Parameterized input for plugins',
      'Input validation and sanitization',
      'Principle of least privilege',
      'Manual approval for sensitive operations',
    ],
    exampleAttackScenarios: [
      'LLM instructs plugin to delete all user data',
      'Plugin executes arbitrary code from LLM output',
    ],
    references: ['https://owasp.org/www-project-top-10-for-large-language-model-applications/'],
    cweMappings: ['CWE-285', 'CWE-693'],
  },
  {
    id: 'LLM08',
    name: 'Excessive Agency',
    description: 'LLM has too much autonomy or permissions',
    riskRating: 'High',
    commonExamples: [
      'LLM can execute destructive actions without approval',
      'LLM has write access to critical systems',
      'No rate limiting on LLM-initiated operations',
    ],
    preventionStrategies: [
      'Limit LLM functionality to minimum required',
      'Human-in-the-loop for high-impact actions',
      'Require user confirmation for destructive ops',
      'Implement undo mechanisms',
    ],
    exampleAttackScenarios: [
      'Jailbroken LLM deletes production database',
      'LLM sends thousands of emails on behalf of user',
    ],
    references: ['https://owasp.org/www-project-top-10-for-large-language-model-applications/'],
    cweMappings: ['CWE-269'],
  },
  {
    id: 'LLM09',
    name: 'Overreliance',
    description: 'Users trust LLM outputs without verification',
    riskRating: 'Medium',
    commonExamples: [
      'Accepting hallucinated information as fact',
      'Following insecure code suggestions',
      'Trusting biased or harmful outputs',
    ],
    preventionStrategies: [
      'User training on LLM limitations',
      'Display confidence scores',
      'Encourage verification of outputs',
      'Cross-reference with authoritative sources',
    ],
    exampleAttackScenarios: [
      'Developer deploys vulnerable code from LLM suggestion',
      'User acts on false information from hallucination',
    ],
    references: ['https://owasp.org/www-project-top-10-for-large-language-model-applications/'],
    cweMappings: ['CWE-1389'],
  },
  {
    id: 'LLM10',
    name: 'Model Theft',
    description: 'Unauthorized access to proprietary LLM models',
    riskRating: 'Medium',
    commonExamples: [
      'API query patterns used to extract model',
      'Insider threat stealing model weights',
      'Side-channel attacks on model infrastructure',
    ],
    preventionStrategies: [
      'Access controls on model APIs',
      'Rate limiting and monitoring',
      'Watermarking model outputs',
      'Secure model storage',
    ],
    exampleAttackScenarios: [
      'Attacker queries API millions of times to clone model',
      'Compromised employee exfiltrates model file',
    ],
    references: ['https://owasp.org/www-project-top-10-for-large-language-model-applications/'],
    cweMappings: ['CWE-285'],
  },
];

export async function importOWASPLLMTop10(): Promise<number> {
  let count = 0;

  for (const vuln of OWASP_LLM_TOP_10) {
    await db.insert(owaspLlmVulnerabilities).values({
      owaspId: vuln.id,
      name: vuln.name,
      description: vuln.description,
      riskRating: vuln.riskRating,
      commonExamples: vuln.commonExamples,
      preventionStrategies: vuln.preventionStrategies,
      exampleAttackScenarios: vuln.exampleAttackScenarios,
      references: vuln.references,
      cweMappings: vuln.cweMappings,
    }).onConflictDoNothing();

    count++;
  }

  return count;
}

export async function getOWASPLLMStats() {
  const vulnsCount = await db.select().from(owaspLlmVulnerabilities);
  const vectorsCount = await db.select().from(owaspLlmAttackVectors);
  const mitigationsCount = await db.select().from(owaspLlmMitigations);

  return {
    vulnerabilities: vulnsCount.length,
    attackVectors: vectorsCount.length,
    mitigations: mitigationsCount.length,
  };
}
