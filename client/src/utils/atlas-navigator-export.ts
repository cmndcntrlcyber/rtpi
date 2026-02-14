/**
 * ATLAS Navigator Layer Export Utility
 * Generates JSON layer files compatible with MITRE ATLAS Navigator
 * https://github.com/mitre-atlas/atlas-navigator
 */

import type { AtlasNavigatorTechnique } from "@shared/types/atlas";

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
 * Generate an ATLAS Navigator layer file from techniques
 */
export function generateAtlasNavigatorLayer(
  techniques: AtlasNavigatorTechnique[],
  options: {
    layerName?: string;
    description?: string;
    highlightColor?: string;
  } = {}
): NavigatorLayer {
  const {
    layerName = "RTPI ATLAS Layer",
    description = "Generated from RTPI",
    highlightColor = "#c6dbef",
  } = options;

  const navigatorTechniques: NavigatorTechnique[] = techniques.map((tech) => ({
    techniqueID: tech.atlasId,
    tactic: tech.killChainPhases?.[0] || undefined,
    color: highlightColor,
    comment: tech.description || "",
    enabled: true,
    metadata: [],
    links: [],
    showSubtechniques: false,
  }));

  const allPlatforms = new Set<string>();
  techniques.forEach((tech) => {
    tech.platforms?.forEach((platform) => allPlatforms.add(platform));
  });

  return {
    name: layerName,
    versions: {
      attack: "4",
      navigator: "4.6.4",
      layer: "4.3",
    },
    domain: "mitre-atlas",
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
export function downloadAtlasNavigatorLayer(
  layer: NavigatorLayer,
  filename: string = "rtpi-atlas-layer.json"
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
 * Export techniques to ATLAS Navigator format and download
 */
export function exportToAtlasNavigator(
  techniques: AtlasNavigatorTechnique[],
  options: {
    layerName?: string;
    description?: string;
    filename?: string;
  } = {}
) {
  const layer = generateAtlasNavigatorLayer(techniques, options);
  const filename =
    options.filename ||
    `${options.layerName?.replace(/\s+/g, "-").toLowerCase() || "rtpi-atlas-layer"}.json`;
  downloadAtlasNavigatorLayer(layer, filename);
}
