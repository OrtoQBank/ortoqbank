import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalMutation } from './_generated/server';

export const migrateLegacyToTaxonomy = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    migrated: v.object({
      themes: v.number(),
      subthemes: v.number(),
      groups: v.number(),
    }),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    const errors: string[] = [];
    let themesCount = 0;
    let subthemesCount = 0;
    let groupsCount = 0;

    try {
      // Step 1: Migrate themes
      const legacyThemes = await ctx.db.query('themes').collect();
      console.log(`Found ${legacyThemes.length} legacy themes to migrate`);

      for (const theme of legacyThemes) {
        try {
          // Check if theme already exists in taxonomy
          const existingTheme = await ctx.db
            .query('taxonomy')
            .withIndex('by_type', q => q.eq('type', 'theme'))
            .filter(q => q.eq(q.field('name'), theme.name))
            .first();

          if (!existingTheme && !dryRun) {
            await ctx.db.insert('taxonomy', {
              name: theme.name,
              type: 'theme',
              prefix: theme.prefix,
              pathIds: [],
              pathNames: [],
            });
          }

          if (!existingTheme) {
            themesCount++;
          }
        } catch (error) {
          errors.push(`Failed to migrate theme "${theme.name}": ${error}`);
        }
      }

      // Step 2: Migrate subthemes
      const legacySubthemes = await ctx.db.query('subthemes').collect();
      console.log(
        `Found ${legacySubthemes.length} legacy subthemes to migrate`,
      );

      for (const subtheme of legacySubthemes) {
        try {
          // Find the corresponding theme in taxonomy
          const legacyTheme = await ctx.db.get(subtheme.themeId);
          if (!legacyTheme) {
            errors.push(
              `Legacy theme not found for subtheme "${subtheme.name}"`,
            );
            continue;
          }

          const taxonomyTheme = await ctx.db
            .query('taxonomy')
            .withIndex('by_type', q => q.eq('type', 'theme'))
            .filter(q => q.eq(q.field('name'), legacyTheme.name))
            .first();

          if (!taxonomyTheme) {
            errors.push(
              `Taxonomy theme not found for subtheme "${subtheme.name}"`,
            );
            continue;
          }

          // Check if subtheme already exists
          const existingSubtheme = await ctx.db
            .query('taxonomy')
            .withIndex('by_parent', q => q.eq('parentId', taxonomyTheme._id))
            .filter(q => q.eq(q.field('name'), subtheme.name))
            .first();

          if (!existingSubtheme && !dryRun) {
            await ctx.db.insert('taxonomy', {
              name: subtheme.name,
              type: 'subtheme',
              parentId: taxonomyTheme._id,
              prefix: subtheme.prefix,
              pathIds: [taxonomyTheme._id],
              pathNames: [taxonomyTheme.name],
            });
          }

          if (!existingSubtheme) {
            subthemesCount++;
          }
        } catch (error) {
          errors.push(
            `Failed to migrate subtheme "${subtheme.name}": ${error}`,
          );
        }
      }

      // Step 3: Migrate groups
      const legacyGroups = await ctx.db.query('groups').collect();
      console.log(`Found ${legacyGroups.length} legacy groups to migrate`);

      for (const group of legacyGroups) {
        try {
          // Find the corresponding subtheme in taxonomy
          const legacySubtheme = await ctx.db.get(group.subthemeId);
          if (!legacySubtheme) {
            errors.push(`Legacy subtheme not found for group "${group.name}"`);
            continue;
          }

          const taxonomySubtheme = await ctx.db
            .query('taxonomy')
            .withIndex('by_type', q => q.eq('type', 'subtheme'))
            .filter(q => q.eq(q.field('name'), legacySubtheme.name))
            .first();

          if (!taxonomySubtheme) {
            errors.push(
              `Taxonomy subtheme not found for group "${group.name}"`,
            );
            continue;
          }

          // Check if group already exists
          const existingGroup = await ctx.db
            .query('taxonomy')
            .withIndex('by_parent', q => q.eq('parentId', taxonomySubtheme._id))
            .filter(q => q.eq(q.field('name'), group.name))
            .first();

          if (!existingGroup && !dryRun) {
            await ctx.db.insert('taxonomy', {
              name: group.name,
              type: 'group',
              parentId: taxonomySubtheme._id,
              prefix: group.prefix,
              pathIds: taxonomySubtheme.pathIds
                ? [...taxonomySubtheme.pathIds, taxonomySubtheme._id]
                : [taxonomySubtheme._id],
              pathNames: taxonomySubtheme.pathNames
                ? [...taxonomySubtheme.pathNames, taxonomySubtheme.name]
                : [taxonomySubtheme.name],
            });
          }

          if (!existingGroup) {
            groupsCount++;
          }
        } catch (error) {
          errors.push(`Failed to migrate group "${group.name}": ${error}`);
        }
      }

      // Step 4: Rebuild hierarchy if not dry run
      if (!dryRun) {
        await ctx.scheduler.runAfter(0, internal.taxonomy.rebuildHierarchy, {});
      }

      return {
        success: errors.length === 0,
        migrated: {
          themes: themesCount,
          subthemes: subthemesCount,
          groups: groupsCount,
        },
        errors,
      };
    } catch (error) {
      errors.push(`Migration failed: ${error}`);
      return {
        success: false,
        migrated: {
          themes: themesCount,
          subthemes: subthemesCount,
          groups: groupsCount,
        },
        errors,
      };
    }
  },
});

export const migrateQuestionsToTaxonomy = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    migrated: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    const batchSize = args.batchSize ?? 100;
    const errors: string[] = [];
    let migratedCount = 0;

    try {
      // Get questions that need migration (have legacy IDs but no taxonomy IDs)
      const questionsToMigrate = await ctx.db
        .query('questions')
        .filter(q =>
          q.and(
            q.neq(q.field('themeId'), null),
            q.eq(q.field('TaxThemeId'), null),
          ),
        )
        .take(batchSize);

      console.log(`Found ${questionsToMigrate.length} questions to migrate`);

      for (const question of questionsToMigrate) {
        try {
          // Find corresponding taxonomy items
          const legacyTheme = await ctx.db.get(question.themeId);
          if (!legacyTheme) {
            errors.push(
              `Legacy theme not found for question "${question.title}"`,
            );
            continue;
          }

          const taxonomyTheme = await ctx.db
            .query('taxonomy')
            .withIndex('by_type', q => q.eq('type', 'theme'))
            .filter(q => q.eq(q.field('name'), legacyTheme.name))
            .first();

          if (!taxonomyTheme) {
            errors.push(
              `Taxonomy theme not found for question "${question.title}"`,
            );
            continue;
          }

          let taxonomySubtheme = null;
          let taxonomyGroup = null;
          const taxonomyPathIds = [taxonomyTheme._id];

          // Handle subtheme if exists
          if (question.subthemeId) {
            const legacySubtheme = await ctx.db.get(question.subthemeId);
            if (legacySubtheme) {
              taxonomySubtheme = await ctx.db
                .query('taxonomy')
                .withIndex('by_parent', q =>
                  q.eq('parentId', taxonomyTheme._id),
                )
                .filter(q => q.eq(q.field('name'), legacySubtheme.name))
                .first();

              if (taxonomySubtheme) {
                taxonomyPathIds.push(taxonomySubtheme._id);
              }
            }
          }

          // Handle group if exists
          if (question.groupId && taxonomySubtheme) {
            const legacyGroup = await ctx.db.get(question.groupId);
            if (legacyGroup) {
              taxonomyGroup = await ctx.db
                .query('taxonomy')
                .withIndex('by_parent', q =>
                  q.eq('parentId', taxonomySubtheme._id),
                )
                .filter(q => q.eq(q.field('name'), legacyGroup.name))
                .first();

              if (taxonomyGroup) {
                taxonomyPathIds.push(taxonomyGroup._id);
              }
            }
          }

          // Update question with taxonomy references
          if (!dryRun) {
            await ctx.db.patch(question._id, {
              TaxThemeId: taxonomyTheme._id,
              TaxSubthemeId: taxonomySubtheme?._id,
              TaxGroupId: taxonomyGroup?._id,
              TaxThemeName: taxonomyTheme.name,
              TaxSubthemeName: taxonomySubtheme?.name,
              TaxGroupName: taxonomyGroup?.name,
              taxonomyPathIds,
            });
          }

          migratedCount++;
        } catch (error) {
          errors.push(
            `Failed to migrate question "${question.title}": ${error}`,
          );
        }
      }

      return {
        success: errors.length === 0,
        migrated: migratedCount,
        errors,
      };
    } catch (error) {
      errors.push(`Question migration failed: ${error}`);
      return {
        success: false,
        migrated: migratedCount,
        errors,
      };
    }
  },
});

export const validateMigration = internalMutation({
  args: {},
  returns: v.object({
    legacy: v.object({
      themes: v.number(),
      subthemes: v.number(),
      groups: v.number(),
      questions: v.number(),
    }),
    taxonomy: v.object({
      themes: v.number(),
      subthemes: v.number(),
      groups: v.number(),
      questionsWithTaxonomy: v.number(),
    }),
    issues: v.array(v.string()),
  }),
  handler: async ctx => {
    const issues: string[] = [];

    // Count legacy items
    const legacyThemes = await ctx.db.query('themes').collect();
    const legacySubthemes = await ctx.db.query('subthemes').collect();
    const legacyGroups = await ctx.db.query('groups').collect();
    const allQuestions = await ctx.db.query('questions').collect();

    // Count taxonomy items
    const taxonomyThemes = await ctx.db
      .query('taxonomy')
      .withIndex('by_type', q => q.eq('type', 'theme'))
      .collect();
    const taxonomySubthemes = await ctx.db
      .query('taxonomy')
      .withIndex('by_type', q => q.eq('type', 'subtheme'))
      .collect();
    const taxonomyGroups = await ctx.db
      .query('taxonomy')
      .withIndex('by_type', q => q.eq('type', 'group'))
      .collect();

    const questionsWithTaxonomy = allQuestions.filter(q => q.TaxThemeId).length;

    // Check for missing items
    if (legacyThemes.length !== taxonomyThemes.length) {
      issues.push(
        `Theme count mismatch: legacy=${legacyThemes.length}, taxonomy=${taxonomyThemes.length}`,
      );
    }

    if (legacySubthemes.length !== taxonomySubthemes.length) {
      issues.push(
        `Subtheme count mismatch: legacy=${legacySubthemes.length}, taxonomy=${taxonomySubthemes.length}`,
      );
    }

    if (legacyGroups.length !== taxonomyGroups.length) {
      issues.push(
        `Group count mismatch: legacy=${legacyGroups.length}, taxonomy=${taxonomyGroups.length}`,
      );
    }

    return {
      legacy: {
        themes: legacyThemes.length,
        subthemes: legacySubthemes.length,
        groups: legacyGroups.length,
        questions: allQuestions.length,
      },
      taxonomy: {
        themes: taxonomyThemes.length,
        subthemes: taxonomySubthemes.length,
        groups: taxonomyGroups.length,
        questionsWithTaxonomy,
      },
      issues,
    };
  },
});
