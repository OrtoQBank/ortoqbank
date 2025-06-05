import { Id } from '../../../../../../../convex/_generated/dataModel';

export interface TaxonomyItem {
  id: Id<'taxonomy'>;
  name: string;
  type: 'theme' | 'subtheme' | 'group';
  parentId?: Id<'taxonomy'>; // Optional: if you have parent relationship data
}

export interface ProcessedTaxonomy {
  selectedTaxThemes: Id<'taxonomy'>[];
  selectedTaxSubthemes: Id<'taxonomy'>[];
  selectedTaxGroups: Id<'taxonomy'>[];
  taxonomyPathIds: Id<'taxonomy'>[];
}

export interface HierarchyGroup {
  rootTheme: TaxonomyItem;
  children: TaxonomyItem[];
}

/**
 * Groups taxonomy selections by their hierarchy families
 * This assumes selections from the same hierarchy branch are logically related
 */
export function groupTaxonomyByHierarchy(
  selections: TaxonomyItem[],
): HierarchyGroup[] {
  const hierarchyMap = new Map<string, HierarchyGroup>();
  const themes = selections.filter(item => item.type === 'theme');

  // Create hierarchy groups starting with themes
  themes.forEach(theme => {
    hierarchyMap.set(theme.id.toString(), {
      rootTheme: theme,
      children: [],
    });
  });

  // Add children (subthemes and groups) to their respective theme groups
  const nonThemes = selections.filter(item => item.type !== 'theme');

  nonThemes.forEach(item => {
    // If you have parentId, use it to find the correct theme
    if (item.parentId && hierarchyMap.has(item.parentId.toString())) {
      hierarchyMap.get(item.parentId.toString())!.children.push(item);
    } else {
      // Fallback: assign to first available theme (simplified approach)
      if (themes.length > 0) {
        const firstTheme = themes[0];
        if (hierarchyMap.has(firstTheme.id.toString())) {
          hierarchyMap.get(firstTheme.id.toString())!.children.push(item);
        }
      }
    }
  });

  return [...hierarchyMap.values()];
}

/**
 * Processes taxonomy selections using hierarchical logic
 * Most specific selection wins: Group > Subtheme > Theme
 */
export function processHierarchicalTaxonomy(
  selections: TaxonomyItem[],
): ProcessedTaxonomy {
  const result: ProcessedTaxonomy = {
    selectedTaxThemes: [],
    selectedTaxSubthemes: [],
    selectedTaxGroups: [],
    taxonomyPathIds: selections.map(s => s.id),
  };

  const hierarchyGroups = groupTaxonomyByHierarchy(selections);

  hierarchyGroups.forEach(group => {
    const allItems = [group.rootTheme, ...group.children];

    const groups = allItems.filter(item => item.type === 'group');
    const subthemes = allItems.filter(item => item.type === 'subtheme');
    const themes = allItems.filter(item => item.type === 'theme');

    // Hierarchical logic: most specific wins
    if (groups.length > 0) {
      // Most specific: use groups only
      result.selectedTaxGroups.push(...groups.map(g => g.id));
    } else if (subthemes.length > 0) {
      // Medium specific: use subthemes only
      result.selectedTaxSubthemes.push(...subthemes.map(s => s.id));
    } else {
      // Least specific: use themes
      result.selectedTaxThemes.push(...themes.map(t => t.id));
    }
  });

  return result;
}

/**
 * Simple approach: process taxonomy selections with hierarchical logic
 * Mirrors the badge display logic for consistency
 */
export function processSimpleTaxonomy(
  selections: TaxonomyItem[],
  taxonomyData?: any[],
): ProcessedTaxonomy {
  const result: ProcessedTaxonomy = {
    selectedTaxThemes: [],
    selectedTaxSubthemes: [],
    selectedTaxGroups: [],
    taxonomyPathIds: selections.map(s => s.id),
  };

  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 processSimpleTaxonomy Debug:');
    console.log('  Input selections:', selections);
  }

  // Get the most specific selections (same logic as TaxFilter badges)
  const mostSpecificSelections = getMostSpecificSelectionsForProcessor(
    selections,
    taxonomyData,
  );

  // Convert to the processed format
  mostSpecificSelections.forEach(item => {
    switch (item.type) {
      case 'group': {
        result.selectedTaxGroups.push(item.id);
        break;
      }
      case 'subtheme': {
        result.selectedTaxSubthemes.push(item.id);
        break;
      }
      case 'theme': {
        result.selectedTaxThemes.push(item.id);
        break;
      }
    }
  });

  if (process.env.NODE_ENV === 'development') {
    console.log('  Most specific selections:', mostSpecificSelections);
    console.log('  Final result (matching badge counts):', result);
    console.log('  Themes:', result.selectedTaxThemes.length);
    console.log('  Subthemes:', result.selectedTaxSubthemes.length);
    console.log('  Groups:', result.selectedTaxGroups.length);
  }

  return result;
}

/**
 * Get most specific selections for processor (matches TaxFilter badge logic exactly)
 * This implements the hierarchical filtering: children override parents
 */
function getMostSpecificSelectionsForProcessor(
  selections: TaxonomyItem[],
  taxonomyData?: any[],
): TaxonomyItem[] {
  const result: TaxonomyItem[] = [];
  const processedIds = new Set<Id<'taxonomy'>>();

  // If no taxonomy data, fall back to simple approach
  if (!taxonomyData || !Array.isArray(taxonomyData)) {
    return selections;
  }

  // Filter selections by type
  const selectedThemes = selections.filter(item => item.type === 'theme');
  const selectedSubthemes = selections.filter(item => item.type === 'subtheme');
  const selectedGroups = selections.filter(item => item.type === 'group');

  // Step 1: Always add all groups (most specific level)
  selectedGroups.forEach(group => {
    result.push(group);
    processedIds.add(group.id);
  });

  // Step 2: Add subthemes that don't have groups selected
  selectedSubthemes.forEach(subtheme => {
    let hasSelectedGroups = false;
    taxonomyData.forEach((theme: any) => {
      if (theme.children) {
        const foundSubtheme = theme.children.find(
          (s: any) => s._id === subtheme.id,
        );
        if (foundSubtheme?.children) {
          hasSelectedGroups = foundSubtheme.children.some((g: any) =>
            selectedGroups.some(group => group.id === g._id),
          );
        }
      }
    });

    if (!hasSelectedGroups && !processedIds.has(subtheme.id)) {
      result.push(subtheme);
      processedIds.add(subtheme.id);
    }
  });

  // Step 3: Add themes that don't have children selected
  selectedThemes.forEach(theme => {
    const hasSelectedChildren = [...selectedSubthemes, ...selectedGroups].some(
      item => {
        if (item.type === 'subtheme') {
          const themeData = taxonomyData.find((t: any) => t._id === theme.id);
          return themeData?.children?.some((s: any) => s._id === item.id);
        }
        if (item.type === 'group') {
          const themeData = taxonomyData.find((t: any) => t._id === theme.id);
          return themeData?.children?.some((s: any) =>
            s.children?.some((g: any) => g._id === item.id),
          );
        }
        return false;
      },
    );

    if (!hasSelectedChildren && !processedIds.has(theme.id)) {
      result.push(theme);
      processedIds.add(theme.id);
    }
  });

  return result;
}

/**
 * Debug helper to visualize the processing result
 */
export function debugTaxonomyProcessing(
  original: TaxonomyItem[],
  processed: ProcessedTaxonomy,
): void {
  console.group('🔍 Taxonomy Processing Debug');
  console.log('Original selections:', original);
  console.log('Processed result:', processed);
  console.log('Themes:', processed.selectedTaxThemes);
  console.log('Subthemes:', processed.selectedTaxSubthemes);
  console.log('Groups:', processed.selectedTaxGroups);
  console.groupEnd();
}
