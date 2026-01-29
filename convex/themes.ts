import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { requireAppModerator, verifyTenantAccess } from './auth';
import { canSafelyDelete, generateDefaultPrefix, normalizeText } from './utils';

// Queries
export const list = query({
  args: { tenantId: v.optional(v.id('apps')) },
  handler: async (context, { tenantId }) => {
    // Verify user has access to this tenant
    await verifyTenantAccess(context, tenantId);

    if (tenantId) {
      return await context.db
        .query('themes')
        .withIndex('by_tenant', q => q.eq('tenantId', tenantId))
        .collect();
    }
    // Fallback for backward compatibility (no tenant filter)
    return await context.db.query('themes').collect();
  },
});

// Returns themes sorted by displayOrder, then name
export const listSorted = query({
  args: { tenantId: v.optional(v.id('apps')) },
  handler: async (context, { tenantId }) => {
    // Verify user has access to this tenant
    await verifyTenantAccess(context, tenantId);

    let themes;
    if (tenantId) {
      themes = await context.db
        .query('themes')
        .withIndex('by_tenant', q => q.eq('tenantId', tenantId))
        .collect();
    } else {
      themes = await context.db.query('themes').collect();
    }

    // Sort themes: displayOrder first (undefined goes last), then alphabetically by name
    return themes.toSorted((a, b) => {
      if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
        return a.displayOrder - b.displayOrder;
      }
      if (a.displayOrder === undefined && b.displayOrder === undefined) {
        return a.name.localeCompare(b.name);
      }
      // a.displayOrder is undefined, b.displayOrder is defined -> a goes after b
      if (a.displayOrder === undefined) return 1;
      // a.displayOrder is defined, b.displayOrder is undefined -> a goes before b
      return -1;
    });
  },
});

export const getById = query({
  args: { id: v.id('themes') },
  handler: async (context, { id }) => {
    return await context.db.get(id);
  },
});

export const getHierarchicalData = query({
  args: { tenantId: v.optional(v.id('apps')) },
  handler: async (context, { tenantId }) => {
    // Verify user has access to this tenant
    await verifyTenantAccess(context, tenantId);

    let themes;
    let subthemes;
    let groups;

    if (tenantId) {
      themes = await context.db
        .query('themes')
        .withIndex('by_tenant', q => q.eq('tenantId', tenantId))
        .collect();
      subthemes = await context.db
        .query('subthemes')
        .withIndex('by_tenant', q => q.eq('tenantId', tenantId))
        .collect();
      groups = await context.db
        .query('groups')
        .withIndex('by_tenant', q => q.eq('tenantId', tenantId))
        .collect();
    } else {
      themes = await context.db.query('themes').collect();
      subthemes = await context.db.query('subthemes').collect();
      groups = await context.db.query('groups').collect();
    }

    return {
      themes,
      subthemes,
      groups,
    };
  },
});

// Mutations
export const create = mutation({
  args: {
    tenantId: v.id('apps'),
    name: v.string(),
    prefix: v.optional(v.string()),
  },
  handler: async (context, { tenantId, name, prefix }) => {
    // Verify moderator access for this app
    await requireAppModerator(context, tenantId);

    // Check if theme with same name already exists (within tenant if provided)
    let existing;
    if (tenantId) {
      existing = await context.db
        .query('themes')
        .withIndex('by_tenant_and_name', q =>
          q.eq('tenantId', tenantId).eq('name', name),
        )
        .unique();
    } else {
      existing = await context.db
        .query('themes')
        .withIndex('by_name', q => q.eq('name', name))
        .unique();
    }

    if (existing) {
      throw new Error(`Theme "${name}" already exists`);
    }

    // Generate default prefix from name if not provided
    let actualPrefix = prefix || generateDefaultPrefix(name, 3);

    // Ensure the prefix is normalized (remove accents)
    actualPrefix = normalizeText(actualPrefix).toUpperCase();

    return await context.db.insert('themes', {
      tenantId,
      name,
      prefix: actualPrefix,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id('themes'),
    name: v.string(),
    prefix: v.optional(v.string()),
  },
  handler: async (context, { id, name, prefix }) => {
    // Check if theme exists
    const existing = await context.db.get(id);
    if (!existing) {
      throw new Error('Theme not found');
    }

    // Verify moderator access for the theme's app
    if (existing.tenantId) {
      await requireAppModerator(context, existing.tenantId);
    }

    // Check if new name conflicts with another theme
    const nameConflict = await context.db
      .query('themes')
      .withIndex('by_name', q => q.eq('name', name))
      .unique();

    if (nameConflict && nameConflict._id !== id) {
      throw new Error(`Theme "${name}" already exists`);
    }

    // Normalize the prefix if one is provided
    const updates: Record<string, unknown> = { name };
    if (prefix !== undefined) {
      updates.prefix = normalizeText(prefix).toUpperCase();
    }

    // Update theme
    return await context.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id('themes') },
  handler: async (context, { id }) => {
    // Check if theme exists first
    const existing = await context.db.get(id);
    if (!existing) {
      throw new Error('Theme not found');
    }

    // Verify moderator access for the theme's app
    if (existing.tenantId) {
      await requireAppModerator(context, existing.tenantId);
    }

    // Define dependencies to check
    const dependencies = [
      {
        table: 'subthemes',
        indexName: 'by_theme',
        fieldName: 'themeId',
        errorMessage: 'Cannot delete theme that has subthemes',
      },
      {
        table: 'questions',
        indexName: 'by_theme',
        fieldName: 'themeId',
        errorMessage: 'Cannot delete theme that is used by questions',
      },
      {
        table: 'presetQuizzes',
        indexName: 'by_theme',
        fieldName: 'themeId',
        errorMessage: 'Cannot delete theme that is used by preset quizzes',
      },
    ];

    // Check if theme can be safely deleted
    await canSafelyDelete(context, id, 'themes', dependencies);

    // If we get here, it means the theme can be safely deleted
    await context.db.delete(id);
  },
});
