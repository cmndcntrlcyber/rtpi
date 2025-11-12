import { CvssVersion } from "./base";
import type {
  CvssDefinition,
  CvssMetricsValue,
  CvssMetricsValueCollection,
} from "./base";

export const CVSS31_DEFINITION: CvssDefinition = Object.freeze({
  AV: {
    id: "AV",
    name: "Attack Vector",
    description:
      "This metric reflects the context by which vulnerability exploitation is possible.",
    choices: [
      {
        id: "N",
        name: "Network",
        description:
          "A vulnerability exploitable with network access means the vulnerable component is bound to the network stack and the attacker's path is through OSI layer 3 (the network layer).",
      },
      {
        id: "A",
        name: "Adjacent",
        description:
          "A vulnerability exploitable with adjacent network access means the vulnerable component is bound to the network stack, however the attack is limited to the same shared physical or logical network.",
      },
      {
        id: "L",
        name: "Local",
        description:
          "A vulnerability exploitable with local access means that the vulnerable component is not bound to the network stack, and the attacker's path is via read/write/execute capabilities.",
      },
      {
        id: "P",
        name: "Physical",
        description:
          "A vulnerability exploitable with physical access requires the attacker to physically touch or manipulate the vulnerable component.",
      },
    ],
  },
  AC: {
    id: "AC",
    name: "Attack Complexity",
    description:
      "This metric describes the conditions beyond the attacker's control that must exist in order to exploit the vulnerability.",
    choices: [
      {
        id: "L",
        name: "Low",
        description:
          "Specialized access conditions or extenuating circumstances do not exist. An attacker can expect repeatable success against the vulnerable component.",
      },
      {
        id: "H",
        name: "High",
        description:
          "A successful attack depends on conditions beyond the attacker's control. That is, a successful attack cannot be accomplished at will.",
      },
    ],
  },
  PR: {
    id: "PR",
    name: "Privileges Required",
    description:
      "This metric describes the level of privileges an attacker must possess before successfully exploiting the vulnerability.",
    choices: [
      {
        id: "N",
        name: "None",
        description:
          "The attacker is unauthorized prior to attack, and therefore does not require any access to settings or files to carry out an attack.",
      },
      {
        id: "L",
        name: "Low",
        description:
          "The attacker is authorized with privileges that provide basic user capabilities that could normally affect only settings and files owned by a user.",
      },
      {
        id: "H",
        name: "High",
        description:
          "The attacker is authorized with privileges that provide significant (e.g. administrative) control over the vulnerable component.",
      },
    ],
  },
  UI: {
    id: "UI",
    name: "User Interaction",
    description:
      "This metric captures the requirement for a user, other than the attacker, to participate in the successful compromise of the vulnerable component.",
    choices: [
      {
        id: "N",
        name: "None",
        description:
          "The vulnerable system can be exploited without any interaction from any user.",
      },
      {
        id: "R",
        name: "Required",
        description:
          "Successful exploitation of this vulnerability requires a user to take some action before the vulnerability can be exploited.",
      },
    ],
  },
  S: {
    id: "S",
    name: "Scope",
    description:
      "Does a successful attack impact a component other than the vulnerable component?",
    choices: [
      {
        id: "U",
        name: "Unchanged",
        description:
          "An exploited vulnerability can only affect resources managed by the same authority.",
      },
      {
        id: "C",
        name: "Changed",
        description:
          "An exploited vulnerability can affect resources beyond the authorization privileges intended by the vulnerable component.",
      },
    ],
  },
  C: {
    id: "C",
    name: "Confidentiality",
    description:
      "This metric measures the impact to the confidentiality of the information resources managed by a software component.",
    choices: [
      {
        id: "N",
        name: "None",
        description: "There is no loss of confidentiality within the impacted component.",
      },
      {
        id: "L",
        name: "Low",
        description:
          "There is some loss of confidentiality. Access to some restricted information is obtained.",
      },
      {
        id: "H",
        name: "High",
        description:
          "There is total loss of confidentiality, resulting in all resources within the impacted component being divulged to the attacker.",
      },
    ],
  },
  I: {
    id: "I",
    name: "Integrity",
    description:
      "This metric measures the impact to integrity of a successfully exploited vulnerability.",
    choices: [
      {
        id: "N",
        name: "None",
        description: "There is no loss of integrity within the impacted component.",
      },
      {
        id: "L",
        name: "Low",
        description:
          "Modification of data is possible, but the attacker does not have control over the consequence of a modification.",
      },
      {
        id: "H",
        name: "High",
        description:
          "There is a total loss of integrity, or a complete loss of protection.",
      },
    ],
  },
  A: {
    id: "A",
    name: "Availability",
    description:
      "This metric measures the impact to the availability of the impacted component resulting from a successfully exploited vulnerability.",
    choices: [
      {
        id: "N",
        name: "None",
        description: "There is no impact to availability within the impacted component.",
      },
      {
        id: "L",
        name: "Low",
        description:
          "There is reduced performance or interruptions in resource availability.",
      },
      {
        id: "H",
        name: "High",
        description:
          "There is total loss of availability, resulting in the attacker being able to fully deny access to resources.",
      },
    ],
  },
});

const CVSS3_METRICS_BASE: CvssMetricsValueCollection = Object.freeze({
  AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
  AC: { L: 0.77, H: 0.44 },
  PR: {
    N: { U: 0.85, C: 0.85 },
    L: { U: 0.62, C: 0.68 },
    H: { U: 0.27, C: 0.5 },
  },
  UI: { N: 0.85, R: 0.62 },
  S: { U: "U", C: "C" },
  C: { N: 0, L: 0.22, H: 0.56 },
  I: { N: 0, L: 0.22, H: 0.56 },
  A: { N: 0, L: 0.22, H: 0.56 },
});

const CVSS3_METRICS: CvssMetricsValueCollection = Object.freeze({
  ...CVSS3_METRICS_BASE,
});

export function parseVectorCvss3(vector?: string | null): CvssMetricsValue {
  const out: CvssMetricsValue = {};
  
  if (!vector) {
    return out;
  }

  // Remove CVSS:3.x/ prefix
  const vectorParts = vector.slice(9).split("/");
  
  for (const part of vectorParts) {
    const [key, value] = part.split(":");
    if (key && value) {
      out[key] = value;
    }
  }

  return out;
}

export function isValidVectorCvss3(vector?: string | null): boolean {
  if (!vector) {
    return false;
  }

  // Check CVSS identifier
  if (!vector.startsWith("CVSS:3.0/") && !vector.startsWith("CVSS:3.1/")) {
    return false;
  }

  const parsedVector = parseVectorCvss3(vector);

  // Check if all base metrics are defined
  const requiredMetrics = ["AV", "AC", "PR", "UI", "S", "C", "I", "A"];
  for (const metric of requiredMetrics) {
    if (!(metric in parsedVector)) {
      return false;
    }
  }

  return true;
}

export function stringifyVectorCvss31(parsedVector: CvssMetricsValue): string {
  let out: string = CvssVersion.CVSS31;
  const metricOrder = ["AV", "AC", "PR", "UI", "S", "C", "I", "A"];
  
  for (const k of metricOrder) {
    if (k in parsedVector && parsedVector[k]) {
      out += `/${k}:${parsedVector[k]}`;
    }
  }
  
  return out;
}

function roundUp(num: number): number {
  const intNum = Math.round(num * 100000);
  if (intNum % 10000 === 0) {
    return intNum / 100000.0;
  } else {
    return (Math.floor(intNum / 10000) + 1) / 10.0;
  }
}

export function calculateScoreCvss31(vector: string): number | null {
  if (!isValidVectorCvss3(vector)) {
    return null;
  }

  const values = parseVectorCvss3(vector);

  function metric(name: string): any {
    const value = values[name];
    if (!value) return null;
    return CVSS3_METRICS[name]?.[value];
  }

  // Base score calculation
  const scopeChanged = metric("S") === "C";
  const iss =
    1 - (1 - metric("C")) * (1 - metric("I")) * (1 - metric("A"));
  const impact = scopeChanged
    ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15)
    : 6.42 * iss;

  const prValue = metric("PR");
  const prScore = prValue?.[metric("S")] ?? prValue;

  const exploitability =
    8.22 * metric("AV") * metric("AC") * prScore * metric("UI");

  const score =
    impact <= 0
      ? 0
      : scopeChanged
      ? roundUp(Math.min(1.08 * (impact + exploitability), 10))
      : roundUp(Math.min(impact + exploitability, 10));

  return score;
}

export function getDefaultMetrics(): CvssMetricsValue {
  return {
    AV: "N",
    AC: "L",
    PR: "N",
    UI: "N",
    S: "U",
    C: "N",
    I: "N",
    A: "N",
  };
}
