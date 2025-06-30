import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { internalMutation } from './_generated/server';

// Helper function to safely extract text from JSON structured content
function safeExtractTextFromJson(
  jsonString: string,
  fallback: string = '',
): string {
  try {
    const parsed = JSON.parse(jsonString);

    // Check if the expected structure exists: content[0].content[0].text
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray(parsed.content) &&
      parsed.content.length > 0 &&
      parsed.content[0] &&
      typeof parsed.content[0] === 'object' &&
      Array.isArray(parsed.content[0].content) &&
      parsed.content[0].content.length > 0 &&
      parsed.content[0].content[0] &&
      typeof parsed.content[0].content[0] === 'object' &&
      typeof parsed.content[0].content[0].text === 'string'
    ) {
      return parsed.content[0].content[0].text;
    }

    // If structure doesn't match, try to extract any text we can find
    if (parsed && typeof parsed === 'object') {
      // Try to find text in a flatter structure
      if (typeof parsed.text === 'string') {
        return parsed.text;
      }

      // Try to find text in content array
      if (Array.isArray(parsed.content)) {
        for (const item of parsed.content) {
          if (item && typeof item.text === 'string') {
            return item.text;
          }
        }
      }
    }

    console.warn(
      'JSON structure does not match expected format, using fallback:',
      jsonString.slice(0, 100),
    );
    return fallback;
  } catch (error) {
    console.error(
      'Failed to parse JSON, using fallback:',
      error,
      jsonString.slice(0, 100),
    );
    return fallback;
  }
}

// Configuration
const QUESTIONS_TO_GENERATE = 100;

// Question templates for variety
const QUESTION_TEMPLATES = [
  'Qual é {concept} em {area}?',
  'Como se caracteriza {condition} na {region}?',
  'Qual é o tratamento indicado para {pathology}?',
  'Qual é a classificação de {classification_system}?',
  'Qual é o diagnóstico diferencial de {symptom}?',
  'Qual é a técnica cirúrgica para {procedure}?',
  'Qual é a anatomia de {structure}?',
  'Qual é a biomecânica de {movement}?',
  'Qual é a fisiopatologia de {disease}?',
  'Qual é a indicação para {treatment}?',
];

const MEDICAL_CONCEPTS = [
  'a articulação mais móvel',
  'o osso mais resistente',
  'o ligamento mais importante',
  'a fratura mais comum',
  'a lesão mais grave',
  'o músculo mais forte',
  'a deformidade congênita',
  'a patologia degenerativa',
  'o trauma mais frequente',
  'a complicação mais séria',
];

const MEDICAL_AREAS = [
  'ortopedia',
  'traumatologia',
  'cirurgia do joelho',
  'cirurgia da coluna',
  'ortopedia pediátrica',
  'medicina esportiva',
  'cirurgia do quadril',
  'cirurgia da mão',
  'cirurgia do ombro',
  'cirurgia do pé',
];

const ALTERNATIVES_POOL = [
  'Opção A',
  'Opção B',
  'Opção C',
  'Opção D',
  'Alternativa 1',
  'Alternativa 2',
  'Alternativa 3',
  'Alternativa 4',
  'Primeira opção',
  'Segunda opção',
  'Terceira opção',
  'Quarta opção',
];

// Function to generate random questions
function generateQuestions(
  count: number,
  themes: Array<{ name: string; prefix: string }>,
  subthemes: Array<{ name: string; prefix: string; themeIndex: number }>,
  groups: Array<{ name: string; prefix: string; subthemeIndex: number }>,
): Array<{
  title: string;
  questionText: string;
  explanation: string;
  alternatives: string[];
  correctAlternativeIndex: number;
  questionCode: string;
  themeIndex: number;
  subthemeIndex: number;
  groupIndex: number;
}> {
  const questions: Array<{
    title: string;
    questionText: string;
    explanation: string;
    alternatives: string[];
    correctAlternativeIndex: number;
    questionCode: string;
    themeIndex: number;
    subthemeIndex: number;
    groupIndex: number;
  }> = [];

  for (let i = 0; i < count; i++) {
    const templateIndex = i % QUESTION_TEMPLATES.length;
    const conceptIndex = i % MEDICAL_CONCEPTS.length;
    const areaIndex = i % MEDICAL_AREAS.length;

    const template = QUESTION_TEMPLATES[templateIndex];
    const concept = MEDICAL_CONCEPTS[conceptIndex];
    const area = MEDICAL_AREAS[areaIndex];

    // Replace placeholders in template
    let questionTitle = template
      .replace('{concept}', concept)
      .replace('{area}', area)
      .replace('{condition}', `condição ${i + 1}`)
      .replace('{region}', `região ${i + 1}`)
      .replace('{pathology}', `patologia ${i + 1}`)
      .replace('{classification_system}', `sistema ${i + 1}`)
      .replace('{symptom}', `sintoma ${i + 1}`)
      .replace('{procedure}', `procedimento ${i + 1}`)
      .replace('{structure}', `estrutura ${i + 1}`)
      .replace('{movement}', `movimento ${i + 1}`)
      .replace('{disease}', `doença ${i + 1}`)
      .replace('{treatment}', `tratamento ${i + 1}`);

    const questionText = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: questionTitle }],
        },
      ],
    });

    const explanation = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: `Explicação para a questão ${i + 1}: Esta é uma explicação placeholder que descreve o conceito médico relacionado à pergunta sobre ${concept} em ${area}.`,
            },
          ],
        },
      ],
    });

    const alternatives = [
      `${ALTERNATIVES_POOL[0]} - Resposta ${i + 1}A`,
      `${ALTERNATIVES_POOL[1]} - Resposta ${i + 1}B`,
      `${ALTERNATIVES_POOL[2]} - Resposta ${i + 1}C`,
      `${ALTERNATIVES_POOL[3]} - Resposta ${i + 1}D`,
    ];

    const correctAlternativeIndex = i % 4; // Rotate correct answers

    // Distribute questions across themes/subthemes/groups with proper hierarchy
    const themeIndex = i % 5; // 5 themes

    // Get subthemes that belong to this theme
    const subthemesForTheme: Array<{
      name: string;
      prefix: string;
      themeIndex: number;
      originalIndex: number;
    }> = subthemes
      .map(
        (
          subtheme: { name: string; prefix: string; themeIndex: number },
          index: number,
        ) => ({ ...subtheme, originalIndex: index }),
      )
      .filter(
        (subtheme: {
          name: string;
          prefix: string;
          themeIndex: number;
          originalIndex: number;
        }) => subtheme.themeIndex === themeIndex,
      );
    const subthemeData: {
      name: string;
      prefix: string;
      themeIndex: number;
      originalIndex: number;
    } = subthemesForTheme[i % subthemesForTheme.length];
    const subthemeIndex: number = subthemeData.originalIndex;

    // Get groups that belong to this subtheme
    const groupsForSubtheme: Array<{
      name: string;
      prefix: string;
      subthemeIndex: number;
      originalIndex: number;
    }> = groups
      .map(
        (
          group: { name: string; prefix: string; subthemeIndex: number },
          index: number,
        ) => ({ ...group, originalIndex: index }),
      )
      .filter(
        (group: {
          name: string;
          prefix: string;
          subthemeIndex: number;
          originalIndex: number;
        }) => group.subthemeIndex === subthemeIndex,
      );

    // If no groups exist for this subtheme, fallback to first available group
    const groupData: {
      name: string;
      prefix: string;
      subthemeIndex: number;
      originalIndex: number;
    } =
      groupsForSubtheme.length > 0
        ? groupsForSubtheme[i % groupsForSubtheme.length]
        : groups.map(
            (
              group: { name: string; prefix: string; subthemeIndex: number },
              index: number,
            ) => ({
              ...group,
              originalIndex: index,
            }),
          )[i % groups.length];
    const groupIndex: number = groupData.originalIndex;

    questions.push({
      title: questionTitle,
      questionText,
      explanation,
      alternatives,
      correctAlternativeIndex,
      questionCode: `Q${String(i + 1).padStart(3, '0')}`,
      themeIndex,
      subthemeIndex,
      groupIndex,
    });
  }

  return questions;
}

// Function to generate sample preset quizzes
function generatePresetQuizzes() {
  return [
    {
      name: 'Trilha Ortopedia Básica',
      description: 'Questões fundamentais de ortopedia',
      category: 'trilha' as const,
      themeIndex: 0, // Ortopedia Básica
      isPublic: true,
      displayOrder: 1,
    },
    {
      name: 'Trilha Traumatologia',
      description: 'Questões sobre trauma ortopédico',
      category: 'trilha' as const,
      themeIndex: 1, // Traumatologia
      isPublic: true,
      displayOrder: 2,
    },
    {
      name: 'Trilha Cirurgia do Joelho',
      description: 'Questões especializadas em joelho',
      category: 'trilha' as const,
      themeIndex: 2, // Cirurgia do Joelho
      isPublic: true,
      displayOrder: 3,
    },
    {
      name: 'Trilha Cirurgia da Coluna',
      description: 'Questões sobre patologias da coluna',
      category: 'trilha' as const,
      themeIndex: 3, // Cirurgia da Coluna
      isPublic: true,
      displayOrder: 4,
    },
    {
      name: 'Trilha Ortopedia Pediátrica',
      description: 'Questões sobre ortopedia infantil',
      category: 'trilha' as const,
      themeIndex: 4, // Ortopedia Pediátrica
      isPublic: true,
      displayOrder: 5,
    },
    {
      name: 'Simulado TEOT',
      description: 'Simulado para prova TEOT',
      category: 'simulado' as const,
      subcategory: 'TEOT',
      isPublic: true,
      displayOrder: 1,
    },
    {
      name: 'Simulado TARO',
      description: 'Simulado para prova TARO',
      category: 'simulado' as const,
      subcategory: 'TARO',
      isPublic: true,
      displayOrder: 2,
    },
  ];
}

// Sample data structure
const themes = [
  { name: 'Ortopedia Básica', prefix: 'ORT' },
  { name: 'Traumatologia', prefix: 'TRA' },
  { name: 'Cirurgia do Joelho', prefix: 'JOE' },
  { name: 'Cirurgia da Coluna', prefix: 'COL' },
  { name: 'Ortopedia Pediátrica', prefix: 'PED' },
];

const subthemes = [
  // Ortopedia Básica subthemes
  { name: 'Anatomia Básica', prefix: 'AB', themeIndex: 0 },
  { name: 'Biomecânica', prefix: 'BM', themeIndex: 0 },
  { name: 'Patologia Básica', prefix: 'PB', themeIndex: 0 },

  // Traumatologia subthemes
  { name: 'Fraturas', prefix: 'FR', themeIndex: 1 },
  { name: 'Luxações', prefix: 'LX', themeIndex: 1 },
  { name: 'Lesões de Partes Moles', prefix: 'PM', themeIndex: 1 },

  // Cirurgia do Joelho subthemes
  { name: 'Menisco', prefix: 'ME', themeIndex: 2 },
  { name: 'Ligamentos', prefix: 'LI', themeIndex: 2 },
  { name: 'Cartilagem', prefix: 'CA', themeIndex: 2 },

  // Cirurgia da Coluna subthemes
  { name: 'Cervical', prefix: 'CE', themeIndex: 3 },
  { name: 'Torácica', prefix: 'TO', themeIndex: 3 },
  { name: 'Lombar', prefix: 'LO', themeIndex: 3 },

  // Ortopedia Pediátrica subthemes
  { name: 'Deformidades Congênitas', prefix: 'DC', themeIndex: 4 },
  { name: 'Displasia do Quadril', prefix: 'DQ', themeIndex: 4 },
  { name: 'Pé Torto Congênito', prefix: 'PC', themeIndex: 4 },
];

const groups = [
  // Anatomia Básica groups
  { name: 'Ossos', prefix: 'O', subthemeIndex: 0 },
  { name: 'Articulações', prefix: 'A', subthemeIndex: 0 },
  { name: 'Músculos', prefix: 'M', subthemeIndex: 0 },

  // Biomecânica groups
  { name: 'Forças', prefix: 'F', subthemeIndex: 1 },
  { name: 'Momentos', prefix: 'M', subthemeIndex: 1 },

  // Patologia Básica groups
  { name: 'Inflamação', prefix: 'I', subthemeIndex: 2 },
  { name: 'Degeneração', prefix: 'D', subthemeIndex: 2 },

  // Fraturas groups
  { name: 'Classificação', prefix: 'C', subthemeIndex: 3 },
  { name: 'Tratamento', prefix: 'T', subthemeIndex: 3 },
  { name: 'Complicações', prefix: 'C', subthemeIndex: 3 },

  // Menisco groups
  { name: 'Lesões Traumáticas', prefix: 'T', subthemeIndex: 6 },
  { name: 'Lesões Degenerativas', prefix: 'D', subthemeIndex: 6 },
];

const SEED_DATA = {
  themes,
  subthemes,
  groups,
  questions: generateQuestions(
    QUESTIONS_TO_GENERATE,
    themes,
    subthemes,
    groups,
  ),
  presetQuizzes: generatePresetQuizzes(),
};

const seedDatabase = internalMutation({
  args: { force: v.optional(v.boolean()) },
  returns: v.object({
    message: v.string(),
    created: v.object({
      themes: v.number(),
      subthemes: v.number(),
      groups: v.number(),
      questions: v.number(),
      presetQuizzes: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    // PRODUCTION SAFETY CHECK
    const deploymentUrl = process.env.CONVEX_SITE_URL || '';
    const isProduction =
      deploymentUrl.includes('.convex.site') ||
      process.env.NODE_ENV === 'production';

    if (isProduction && !args.force) {
      throw new Error(
        'SAFETY: This seeding function is blocked in production. ' +
          'If you really need to run this, set force=true, but this is DANGEROUS!',
      );
    }

    if (isProduction && args.force) {
      console.warn(
        'WARNING: Running database seeding in PRODUCTION with force=true!',
      );
    }

    // Check if data already exists to make this idempotent
    const existingThemes = await ctx.db.query('themes').collect();
    if (existingThemes.length > 0 && !args.force) {
      return {
        message: 'Database already seeded, skipping initialization',
        created: {
          themes: 0,
          subthemes: 0,
          groups: 0,
          questions: 0,
          presetQuizzes: 0,
        },
      };
    }

    console.log('Starting database seeding...');

    // Create themes
    const createdThemes: Id<'themes'>[] = [];
    for (const themeData of SEED_DATA.themes) {
      const themeId = await ctx.db.insert('themes', {
        name: themeData.name,
        prefix: themeData.prefix,
        displayOrder: createdThemes.length + 1,
      });
      createdThemes.push(themeId);
      console.log(`Created theme: ${themeData.name}`);
    }

    // Create subthemes
    const createdSubthemes: Id<'subthemes'>[] = [];
    for (const subthemeData of SEED_DATA.subthemes) {
      const subthemeId = await ctx.db.insert('subthemes', {
        name: subthemeData.name,
        prefix: subthemeData.prefix,
        themeId: createdThemes[subthemeData.themeIndex],
      });
      createdSubthemes.push(subthemeId);
      console.log(`Created subtheme: ${subthemeData.name}`);
    }

    // Create groups
    const createdGroups: Id<'groups'>[] = [];
    for (const groupData of SEED_DATA.groups) {
      const groupId = await ctx.db.insert('groups', {
        name: groupData.name,
        prefix: groupData.prefix,
        subthemeId: createdSubthemes[groupData.subthemeIndex],
      });
      createdGroups.push(groupId);
      console.log(`Created group: ${groupData.name}`);
    }

    // Create questions
    const createdQuestions: Id<'questions'>[] = [];
    for (const questionData of SEED_DATA.questions) {
      const questionId = await ctx.db.insert('questions', {
        title: questionData.title,
        normalizedTitle: questionData.title.toLowerCase().trim(),
        questionCode: questionData.questionCode,
        questionText: questionData.questionText,
        explanationText: questionData.explanation,
        questionTextString: questionData.questionText,
        explanationTextString: questionData.explanation,
        alternatives: questionData.alternatives,
        correctAlternativeIndex: questionData.correctAlternativeIndex,
        themeId: createdThemes[questionData.themeIndex],
        subthemeId: createdSubthemes[questionData.subthemeIndex],
        groupId: createdGroups[questionData.groupIndex],
        isPublic: true,
        contentMigrated: true,
      });
      createdQuestions.push(questionId);
      console.log(`Created question: ${questionData.title}`);
    }

    // Create preset quizzes
    let createdPresetQuizzesCount = 0;
    for (const presetQuizData of SEED_DATA.presetQuizzes) {
      // Get questions for this theme (for trilhas) or random questions (for simulados)
      let questionsForQuiz: Id<'questions'>[] = [];

      if (
        presetQuizData.category === 'trilha' &&
        presetQuizData.themeIndex !== undefined
      ) {
        // Get questions from the specific theme - track original indices for efficiency
        const themeQuestionIndices: number[] = [];
        for (
          let i = 0;
          i < SEED_DATA.questions.length && themeQuestionIndices.length < 10;
          i++
        ) {
          if (SEED_DATA.questions[i].themeIndex === presetQuizData.themeIndex) {
            themeQuestionIndices.push(i);
          }
        }

        // Map directly to created questions using the tracked indices
        questionsForQuiz = themeQuestionIndices.map(
          index => createdQuestions[index],
        );
      } else {
        // For simulados, take random questions from different themes
        questionsForQuiz = createdQuestions.slice(0, 15); // Take first 15 questions
      }

      const presetQuizId = await ctx.db.insert('presetQuizzes', {
        name: presetQuizData.name,
        description: presetQuizData.description,
        category: presetQuizData.category,
        themeId:
          presetQuizData.themeIndex === undefined
            ? undefined
            : createdThemes[presetQuizData.themeIndex],
        questions: questionsForQuiz,
        isPublic: presetQuizData.isPublic,
        subcategory: presetQuizData.subcategory,
        displayOrder: presetQuizData.displayOrder,
      });

      createdPresetQuizzesCount++;
      console.log(`Created preset quiz: ${presetQuizData.name}`);
    }

    console.log('Database seeding completed successfully!');

    return {
      message: 'Database seeded successfully',
      created: {
        themes: createdThemes.length,
        subthemes: createdSubthemes.length,
        groups: createdGroups.length,
        questions: createdQuestions.length,
        presetQuizzes: createdPresetQuizzesCount,
      },
    };
  },
});

const seedPresetQuizzesOnly = internalMutation({
  args: {},
  returns: v.object({
    message: v.string(),
    created: v.object({
      presetQuizzes: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    // PRODUCTION SAFETY CHECK
    const deploymentUrl = process.env.CONVEX_SITE_URL || '';
    const isProduction =
      deploymentUrl.includes('.convex.site') ||
      process.env.NODE_ENV === 'production';

    if (isProduction) {
      throw new Error(
        'SAFETY: This seeding function is blocked in production to prevent data corruption!',
      );
    }

    console.log('Seeding presetQuizzes only...');

    // Get existing themes
    const existingThemes = await ctx.db.query('themes').collect();
    if (existingThemes.length === 0) {
      throw new Error(
        'No themes found. Please run the full seed function first.',
      );
    }

    // Get existing questions
    const existingQuestions = await ctx.db.query('questions').collect();
    if (existingQuestions.length === 0) {
      throw new Error(
        'No questions found. Please run the full seed function first.',
      );
    }

    // Create preset quizzes
    let createdPresetQuizzesCount = 0;
    for (const presetQuizData of SEED_DATA.presetQuizzes) {
      // Get questions for this theme (for trilhas) or random questions (for simulados)
      let questionsForQuiz: Id<'questions'>[] = [];

      if (
        presetQuizData.category === 'trilha' &&
        presetQuizData.themeIndex !== undefined
      ) {
        // Get questions from the specific theme
        const themeId = existingThemes[presetQuizData.themeIndex]._id;
        const themeQuestions = existingQuestions
          .filter(q => q.themeId === themeId)
          .slice(0, 10); // Take first 10 questions from this theme

        questionsForQuiz = themeQuestions.map(q => q._id);
      } else {
        // For simulados, take random questions from different themes
        questionsForQuiz = existingQuestions.slice(0, 15).map(q => q._id); // Take first 15 questions
      }

      const presetQuizId = await ctx.db.insert('presetQuizzes', {
        name: presetQuizData.name,
        description: presetQuizData.description,
        category: presetQuizData.category,
        themeId:
          presetQuizData.themeIndex === undefined
            ? undefined
            : existingThemes[presetQuizData.themeIndex]._id,
        questions: questionsForQuiz,
        isPublic: presetQuizData.isPublic,
        subcategory: presetQuizData.subcategory,
        displayOrder: presetQuizData.displayOrder,
      });

      createdPresetQuizzesCount++;
      console.log(`Created preset quiz: ${presetQuizData.name}`);
    }

    console.log('PresetQuizzes seeding completed successfully!');

    return {
      message: 'PresetQuizzes seeded successfully',
      created: {
        presetQuizzes: createdPresetQuizzesCount,
      },
    };
  },
});

const clearPresetQuizzes = internalMutation({
  args: {},
  returns: v.object({ message: v.string(), deletedCount: v.number() }),
  handler: async (ctx, args) => {
    // PRODUCTION SAFETY CHECK
    const deploymentUrl = process.env.CONVEX_SITE_URL || '';
    const isProduction =
      deploymentUrl.includes('.convex.site') ||
      process.env.NODE_ENV === 'production';

    if (isProduction) {
      throw new Error(
        'SAFETY: This clear function is blocked in production to prevent data loss!',
      );
    }

    const allPresetQuizzes = await ctx.db.query('presetQuizzes').collect();
    let deletedCount = 0;

    for (const quiz of allPresetQuizzes) {
      await ctx.db.delete(quiz._id);
      deletedCount++;
    }

    return {
      message: `Cleared ${deletedCount} preset quizzes`,
      deletedCount,
    };
  },
});

// Export as default so it can be called with `npx convex run init`
export default seedDatabase;

// Export the clear function separately
export { clearPresetQuizzes, seedPresetQuizzesOnly };
