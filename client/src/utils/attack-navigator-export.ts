/**
 * ATT&CK Navigator Layer Export Utility
 * Generates JSON layer files compatible with MITRE ATT&CK Navigator
 * https://github.com/mitre-attack/attack-navigator
 */

import type { NavigatorTechnique as SimpleTechnique } from "@shared/types/attack";

// ATT&CK Navigator technique format
interface NavigatorTechnique {
  techniqueID: string;
  tactic?: string;
  color?: string;
  comment?: string;
  enabled: boolean;
  metadata?: any[];
  links?: any[];
  showSubtechniques?: boolean;
}

interface NavigatorLayer {
  name: string;
  versions: {
    attack: string;
    navigator: string;
    layer: string;
  };
  domain: string;
  description: string;
  filters: {
    platforms: string[];
  };
  sorting: number;
  layout: {
    layout: string;
    aggregateFunction: string;
    showID: boolean;
    showName: boolean;
    showAggregateScores: boolean;
    countUnscored: boolean;
  };
  hideDisabled: boolean;
  techniques: NavigatorTechnique[];
  gradient: {
    colors: string[];
    minValue: number;
    maxValue: number;
  };
  legendItems: any[];
  metadata: any[];
  links: any[];
  showTacticRowBackground: boolean;
  tacticRowBackground: string;
  selectTechniquesAcrossTactics: boolean;
  selectSubtechniquesWithParent: boolean;
}

/**
 * Generate an ATT&CK Navigator layer file from techniques
 */
export function generateNavigatorLayer(
  techniques: SimpleTechnique[],
  options: {
    layerName?: string;
    description?: string;
    domain?: string;
    highlightColor?: string;
  } = {}
): NavigatorLayer {
  const {
    layerName = "RTPI ATT&CK Layer",
    description = "Generated from RTPI",
    domain = "enterprise-attack",
    highlightColor = "#66b1ff",
  } = options;

  const navigatorTechniques: NavigatorTechnique[] = techniques.map((tech) => ({
    techniqueID: tech.attackId,
    tactic: tech.killChainPhases?.[0] || undefined,
    color: highlightColor,
    comment: tech.description || "",
    enabled: true,
    metadata: [],
    links: [],
    showSubtechniques: false,
  }));

  // Extract unique platforms
  const allPlatforms = new Set<string>();
  techniques.forEach((tech) => {
    tech.platforms?.forEach((platform) => allPlatforms.add(platform));
  });

  return {
    name: layerName,
    versions: {
      attack: "15",
      navigator: "4.9.1",
      layer: "4.5",
    },
    domain,
    description,
    filters: {
      platforms: Array.from(allPlatforms),
    },
    sorting: 0,
    layout: {
      layout: "side",
      aggregateFunction: "average",
      showID: false,
      showName: true,
      showAggregateScores: false,
      countUnscored: false,
    },
    hideDisabled: false,
    techniques: navigatorTechniques,
    gradient: {
      colors: ["#ff6666ff", "#ffe766ff", "#8ec843ff"],
      minValue: 0,
      maxValue: 100,
    },
    legendItems: [],
    metadata: [],
    links: [],
    showTacticRowBackground: false,
    tacticRowBackground: "#dddddd",
    selectTechniquesAcrossTactics: true,
    selectSubtechniquesWithParent: false,
  };
}

/**
 * Download the layer as a JSON file
 */
export function downloadNavigatorLayer(
  layer: NavigatorLayer,
  filename: string = "rtpi-attack-layer.json"
) {
  const json = JSON.stringify(layer, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Export techniques to ATT&CK Navigator format and download
 */
export function exportToNavigator(
  techniques: SimpleTechnique[],
  options: {
    layerName?: string;
    description?: string;
    filename?: string;
  } = {}
) {
  const layer = generateNavigatorLayer(techniques, options);
  const filename = options.filename || `${options.layerName?.replace(/\s+/g, "-").toLowerCase() || "rtpi-attack-layer"}.json`;
  downloadNavigatorLayer(layer, filename);
}
