import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { requireAppModerator, verifyTenantAccess } from './auth';
import { canSafelyDelete, generateDefaultPrefix, normalizeText } from './utils';

// Queries
export const list = query({
  args: {
    tenantId: v.optional(v.id('apps')),
    themeId: v.optional(v.id('themes')),
  },
  handler: async (context, { tenantId, themeId }) => {
    // Verify user has access to this tenant
    await verifyTenantAccess(context, tenantId);

    // If both tenantId and themeId are provided, use the compound index
    if (tenantId && themeId) {
      return await context.db
        .query('subthemes')
        .withIndex('by_tenant_and_theme', q =>
          q.eq('tenantId', tenantId).eq('themeId', themeId),
        )
        .collect();
    }

    // If only tenantId is provided
    if (tenantId) {
      return await context.db
        .query('subthemes')
        .withIndex('by_tenant', q => q.eq('tenantId', tenantId))
        .collect();
    }

    // If only themeId is provided (backward compatibility)
    if (themeId) {
      return await context.db
        .query('subthemes')
        .withIndex('by_theme', q => q.eq('themeId', themeId))
        .collect();
    }

    // No filters - return all (backward compatibility)
    return await context.db.query('subthemes').collect();
  },
});

export const getById = query({
  args: { id: v.id('subthemes') },
  handler: async (context, { id }) => {
    return await context.db.get(id);
  },
});

export const listByThemes = query({
  args: { tenantId: v.optional(v.id('apps')) },
  handler: async (context, { tenantId }) => {
    // Verify user has access to this tenant
    await verifyTenantAccess(context, tenantId);

    if (tenantId) {
      return await context.db
        .query('subthemes')
        .withIndex('by_tenant', q => q.eq('tenantId', tenantId))
        .collect();
    }
    return await context.db.query('subthemes').collect();
  },
});

// Mutations
export const create = mutation({
  args: {
    tenantId: v.id('apps'),
    name: v.string(),
    themeId: v.id('themes'),
    prefix: v.optional(v.string()),
  },
  handler: async (context, { tenantId, name, themeId, prefix }) => {
    // Verify moderator access for this app
    await requireAppModerator(context, tenantId);

    // Check if theme exists
    const theme = await context.db.get(themeId);
    if (!theme) {
      throw new Error('Theme not found');
    }

    // Generate default prefix from name if not provided
    let actualPrefix = prefix || generateDefaultPrefix(name, 2);

    // Ensure the prefix is normalized (remove accents)
    actualPrefix = normalizeText(actualPrefix).toUpperCase();

    return await context.db.insert('subthemes', {
      tenantId,
      name,
      themeId,
      prefix: actualPrefix,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id('subthemes'),
    name: v.string(),
    themeId: v.id('themes'),
    prefix: v.optional(v.string()),
  },
  handler: async (context, { id, name, themeId, prefix }) => {
    // Check if subtheme exists
    const existing = await context.db.get(id);
    if (!existing) {
      throw new Error('Subtheme not found');
    }

    // Verify moderator access for the subtheme's app
    if (existing.tenantId) {
      await requireAppModerator(context, existing.tenantId);
    }

    // Check if theme exists
    const theme = await context.db.get(themeId);
    if (!theme) {
      throw new Error('Theme not found');
    }

    // Normalize the prefix if one is provided
    const updates: Record<string, unknown> = { name, themeId };
    if (prefix !== undefined) {
      updates.prefix = normalizeText(prefix).toUpperCase();
    }

    return await context.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id('subthemes') },
  handler: async (context, { id }) => {
    // Check if subtheme exists first
    const existing = await context.db.get(id);
    if (!existing) {
      throw new Error('Subtheme not found');
    }

    // Verify moderator access for the subtheme's app
    if (existing.tenantId) {
      await requireAppModerator(context, existing.tenantId);
    }

    // Define dependencies to check
    const dependencies = [
      {
        table: 'groups',
        indexName: 'by_subtheme',
        fieldName: 'subthemeId',
        errorMessage: 'Cannot delete subtheme that has groups',
      },
      {
        table: 'questions',
        indexName: 'by_subtheme',
        fieldName: 'subthemeId',
        errorMessage: 'Cannot delete subtheme that is used by questions',
      },
      {
        table: 'presetQuizzes',
        indexName: 'by_subtheme',
        fieldName: 'subthemeId',
        errorMessage: 'Cannot delete subtheme that is used by preset quizzes',
      },
    ];

    // Check if subtheme can be safely deleted
    await canSafelyDelete(context, id, 'subthemes', dependencies);

    // If we get here, it means the subtheme can be safely deleted
    await context.db.delete(id);
  },
});
