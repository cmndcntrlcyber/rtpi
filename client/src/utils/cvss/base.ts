export type CvssMetricDefinition = {
  id: string;
  name: string;
  description: string;
  choices: {
    id: string;
    name: string;
    description: string;
  }[];
};

export type CvssDefinition = Record<string, CvssMetricDefinition>;
export type CvssMetricsValue = Record<string, string | null>;
export type CvssMetricsValueCollection = Record<string, any>;

export enum CvssVersion {
  CVSS30 = "CVSS:3.0",
  CVSS31 = "CVSS:3.1",
  CVSS40 = "CVSS:4.0",
}

export type ParsedCvssVector = {
  version: CvssVersion | null;
  metrics: CvssMetricsValue;
};

export function getSeverityRating(score: number): {
  label: string;
  color: string;
} {
  if (score === 0) {
    return { label: "None", color: "gray" };
  } else if (score < 4.0) {
    return { label: "Low", color: "blue" };
  } else if (score < 7.0) {
    return { label: "Medium", color: "yellow" };
  } else if (score < 9.0) {
    return { label: "High", color: "orange" };
  } else {
    return { label: "Critical", color: "red" };
  }
}
