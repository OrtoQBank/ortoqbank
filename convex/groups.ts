import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { requireAppModerator, verifyTenantAccess } from './auth';
import { canSafelyDelete, generateDefaultPrefix, normalizeText } from './utils';

// Queries
export const list = query({
  args: {
    tenantId: v.optional(v.id('apps')),
    subthemeId: v.optional(v.id('subthemes')),
  },
  handler: async (context, { tenantId, subthemeId }) => {
    // Verify user has access to this tenant
    await verifyTenantAccess(context, tenantId);

    // If both tenantId and subthemeId are provided, use the compound index
    if (tenantId && subthemeId) {
      return await context.db
        .query('groups')
        .withIndex('by_tenant_and_subtheme', q =>
          q.eq('tenantId', tenantId).eq('subthemeId', subthemeId),
        )
        .collect();
    }

    // If only tenantId is provided
    if (tenantId) {
      return await context.db
        .query('groups')
        .withIndex('by_tenant', q => q.eq('tenantId', tenantId))
        .collect();
    }

    // If only subthemeId is provided (backward compatibility)
    if (subthemeId) {
      return await context.db
        .query('groups')
        .withIndex('by_subtheme', q => q.eq('subthemeId', subthemeId))
        .collect();
    }

    // No filters - return all (backward compatibility)
    return await context.db.query('groups').collect();
  },
});

export const getById = query({
  args: { id: v.id('groups') },
  handler: async (context, { id }) => {
    return await context.db.get(id);
  },
});

// Mutations
export const create = mutation({
  args: {
    tenantId: v.id('apps'),
    name: v.string(),
    subthemeId: v.id('subthemes'),
    prefix: v.optional(v.string()),
  },
  handler: async (context, { tenantId, name, subthemeId, prefix }) => {
    // Verify moderator access for this app
    await requireAppModerator(context, tenantId);

    // Check if subtheme exists
    const subtheme = await context.db.get(subthemeId);
    if (!subtheme) {
      throw new Error('Subtheme not found');
    }

    // Generate default prefix from name if not provided
    let actualPrefix = prefix || generateDefaultPrefix(name, 1);

    // Ensure the prefix is normalized (remove accents)
    actualPrefix = normalizeText(actualPrefix).toUpperCase();

    return await context.db.insert('groups', {
      tenantId,
      name,
      subthemeId,
      prefix: actualPrefix,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id('groups'),
    name: v.string(),
    subthemeId: v.id('subthemes'),
    prefix: v.optional(v.string()),
  },
  handler: async (context, { id, name, subthemeId, prefix }) => {
    // Check if group exists
    const existing = await context.db.get(id);
    if (!existing) {
      throw new Error('Group not found');
    }

    // Verify moderator access for the group's app
    if (existing.tenantId) {
      await requireAppModerator(context, existing.tenantId);
    }

    // Check if subtheme exists
    const subtheme = await context.db.get(subthemeId);
    if (!subtheme) {
      throw new Error('Subtheme not found');
    }

    // Normalize the prefix if one is provided
    const updates: Record<string, unknown> = { name, subthemeId };
    if (prefix !== undefined) {
      updates.prefix = normalizeText(prefix).toUpperCase();
    }

    return await context.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id('groups') },
  handler: async (context, { id }) => {
    // Check if group exists first
    const existing = await context.db.get(id);
    if (!existing) {
      throw new Error('Group not found');
    }

    // Verify moderator access for the group's app
    if (existing.tenantId) {
      await requireAppModerator(context, existing.tenantId);
    }

    // Define dependencies to check
    const dependencies = [
      {
        table: 'questions',
        indexName: 'by_group',
        fieldName: 'groupId',
        errorMessage: 'Cannot delete group that is used by questions',
      },
      {
        table: 'presetQuizzes',
        indexName: 'by_group',
        fieldName: 'groupId',
        errorMessage: 'Cannot delete group that is used by preset quizzes',
      },
    ];

    // Check if group can be safely deleted
    await canSafelyDelete(context, id, 'groups', dependencies);

    // If we get here, it means the group can be safely deleted
    await context.db.delete(id);
  },
});
