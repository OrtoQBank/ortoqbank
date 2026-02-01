import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { internalMutation } from './_generated/server';

// ============================================================
// MULTI-TENANT SEED DATA
// Seeds 4 tenants with tenant-specific content for testing
// ============================================================

// Tenant configurations
const TENANTS = [
  {
    slug: 'ortoqbank',
    name: 'OrtoQBank',
    domain: 'ortoqbank.com',
    description:
      'Banco de questões de ortopedia - Preparatório para provas e concursos',
    isActive: true,
    themes: [
      { name: 'Trauma', prefix: 'TRA', displayOrder: 1 },
      { name: 'Ortopedia Pediátrica', prefix: 'PED', displayOrder: 2 },
      { name: 'Ombro e Cotovelo', prefix: 'OEC', displayOrder: 3 },
    ],
    subthemes: [
      { name: 'Fraturas de Membro Superior', prefix: 'FMS', themeIndex: 0 },
      { name: 'Fraturas de Membro Inferior', prefix: 'FMI', themeIndex: 0 },
      { name: 'Displasia do Desenvolvimento', prefix: 'DDQ', themeIndex: 1 },
      { name: 'Pé Torto Congênito', prefix: 'PTC', themeIndex: 1 },
      { name: 'Manguito Rotador', prefix: 'MRT', themeIndex: 2 },
      { name: 'Instabilidade Glenoumeral', prefix: 'IGU', themeIndex: 2 },
    ],
    groups: [
      { name: 'Classificação', prefix: 'CL', subthemeIndex: 0 },
      { name: 'Tratamento Conservador', prefix: 'TCO', subthemeIndex: 0 },
      { name: 'Screening', prefix: 'SC', subthemeIndex: 2 },
    ],
    questionTemplates: [
      {
        title:
          'Qual é a classificação mais utilizada para fraturas do rádio distal?',
        alternatives: [
          'Classificação AO/ASIF',
          'Classificação de Neer',
          'Classificação de Garden',
          'Classificação de Schatzker',
        ],
        correctIndex: 0,
        themeIndex: 0,
        subthemeIndex: 0,
        groupIndex: 0,
      },
      {
        title:
          'Qual é o tratamento inicial para fraturas estáveis do rádio distal?',
        alternatives: [
          'Imobilização gessada',
          'Fixação com placa volar',
          'Fixação externa',
          'Fixação com fios de Kirschner',
        ],
        correctIndex: 0,
        themeIndex: 0,
        subthemeIndex: 0,
        groupIndex: 1,
      },
      {
        title: 'Qual é a idade ideal para iniciar o screening de DDQ?',
        alternatives: ['Ao nascimento', '3 meses', '6 meses', '1 ano'],
        correctIndex: 0,
        themeIndex: 1,
        subthemeIndex: 2,
        groupIndex: 2,
      },
      {
        title: 'Qual músculo NÃO faz parte do manguito rotador?',
        alternatives: [
          'Deltóide',
          'Supraespinhal',
          'Infraespinhal',
          'Subescapular',
        ],
        correctIndex: 0,
        themeIndex: 2,
        subthemeIndex: 4,
      },
    ],
    pricingPlan: {
      name: 'Plano Anual OrtoQBank 2026',
      badge: 'POPULAR',
      price: 'R$ 299,90',
      productId: 'ortoqbank_2026',
    },
  },
  {
    slug: 'teot',
    name: 'OrtoQBank TEOT',
    domain: 'teot.ortoqbank.com',
    description:
      'Preparatório para o TEOT - Título de Especialista em Ortopedia e Traumatologia',
    isActive: true,
    themes: [
      { name: 'Joelho', prefix: 'JOE', displayOrder: 1 },
      { name: 'Quadril', prefix: 'QUA', displayOrder: 2 },
      { name: 'Coluna', prefix: 'COL', displayOrder: 3 },
    ],
    subthemes: [
      { name: 'Ligamento Cruzado Anterior', prefix: 'LCA', themeIndex: 0 },
      { name: 'Menisco', prefix: 'MEN', themeIndex: 0 },
      { name: 'Artrose', prefix: 'ART', themeIndex: 0 },
      { name: 'Artroplastia Total', prefix: 'ATQ', themeIndex: 1 },
      { name: 'Fraturas do Fêmur', prefix: 'FFP', themeIndex: 1 },
      { name: 'Hérnia Discal', prefix: 'HD', themeIndex: 2 },
      { name: 'Estenose Lombar', prefix: 'EST', themeIndex: 2 },
    ],
    groups: [
      { name: 'Diagnóstico', prefix: 'DG', subthemeIndex: 0 },
      { name: 'Tratamento Cirúrgico', prefix: 'TC', subthemeIndex: 0 },
      { name: 'Lesões Agudas', prefix: 'LA', subthemeIndex: 1 },
      { name: 'Indicações', prefix: 'IND', subthemeIndex: 3 },
      { name: 'Complicações', prefix: 'COM', subthemeIndex: 3 },
    ],
    questionTemplates: [
      {
        title: 'Qual é o principal teste clínico para lesão do LCA?',
        alternatives: [
          'Teste de Lachman',
          'Teste de McMurray',
          'Teste de Thomas',
          'Teste de Ober',
        ],
        correctIndex: 0,
        themeIndex: 0,
        subthemeIndex: 0,
        groupIndex: 0,
      },
      {
        title: 'Qual é o enxerto mais utilizado na reconstrução do LCA?',
        alternatives: [
          'Tendão patelar',
          'Tendão quadricipital',
          'Isquiotibiais',
          'Aloenxerto',
        ],
        correctIndex: 2,
        themeIndex: 0,
        subthemeIndex: 0,
        groupIndex: 1,
      },
      {
        title: 'Qual é a classificação utilizada para lesões meniscais?',
        alternatives: ['ISAKOS', 'Outerbridge', 'Kellgren-Lawrence', 'Tönnis'],
        correctIndex: 0,
        themeIndex: 0,
        subthemeIndex: 1,
        groupIndex: 2,
      },
      {
        title:
          'Qual é a indicação primária para artroplastia total do quadril?',
        alternatives: [
          'Artrose primária',
          'Fratura do colo',
          'Necrose avascular',
          'Artrite reumatoide',
        ],
        correctIndex: 0,
        themeIndex: 1,
        subthemeIndex: 3,
        groupIndex: 3,
      },
      {
        title: 'Qual é a complicação mais temida após ATQ?',
        alternatives: [
          'Luxação',
          'Infecção',
          'Trombose venosa',
          'Fratura periprotética',
        ],
        correctIndex: 1,
        themeIndex: 1,
        subthemeIndex: 3,
        groupIndex: 4,
      },
      {
        title: 'Qual classificação é usada para fraturas do colo femoral?',
        alternatives: ['Garden', 'Neer', 'Mason', 'Schatzker'],
        correctIndex: 0,
        themeIndex: 1,
        subthemeIndex: 4,
      },
      {
        title: 'Qual é o nível vertebral mais acometido por hérnia discal?',
        alternatives: ['L4-L5', 'L3-L4', 'L5-S1', 'L2-L3'],
        correctIndex: 2,
        themeIndex: 2,
        subthemeIndex: 5,
      },
      {
        title: 'Qual é o principal sintoma de estenose lombar?',
        alternatives: [
          'Claudicação neurogênica',
          'Dor radicular',
          'Lombalgia',
          'Parestesia',
        ],
        correctIndex: 0,
        themeIndex: 2,
        subthemeIndex: 6,
      },
    ],
    pricingPlan: {
      name: 'Plano Anual TEOT 2026',
      badge: 'RECOMENDADO',
      price: 'R$ 399,90',
      productId: 'ortoqbank_teot_2026',
    },
  },
  {
    slug: 'derma',
    name: 'DermaQBank',
    domain: 'derma.ortoqbank.com',
    description:
      'Preparatório para o TED - Título de Especialista em Dermatologia',
    isActive: true,
    themes: [
      { name: 'Dermatoses Inflamatórias', prefix: 'INF', displayOrder: 1 },
      { name: 'Dermatologia Oncológica', prefix: 'ONC', displayOrder: 2 },
      { name: 'Infecções Cutâneas', prefix: 'ICU', displayOrder: 3 },
    ],
    subthemes: [
      { name: 'Psoríase', prefix: 'PSO', themeIndex: 0 },
      { name: 'Dermatite Atópica', prefix: 'DA', themeIndex: 0 },
      { name: 'Melanoma', prefix: 'MEL', themeIndex: 1 },
      { name: 'Carcinoma Basocelular', prefix: 'CBC', themeIndex: 1 },
      { name: 'Micoses Superficiais', prefix: 'MIC', themeIndex: 2 },
      { name: 'Hanseníase', prefix: 'HAN', themeIndex: 2 },
    ],
    groups: [
      { name: 'Diagnóstico Clínico', prefix: 'DC', subthemeIndex: 0 },
      { name: 'Tratamento Sistêmico', prefix: 'TS', subthemeIndex: 0 },
      { name: 'Estadiamento', prefix: 'EST', subthemeIndex: 2 },
    ],
    questionTemplates: [
      {
        title: 'Qual é o fenômeno característico da psoríase?',
        alternatives: [
          'Fenômeno de Koebner',
          'Sinal de Darier',
          'Fenômeno de Raynaud',
          'Sinal de Nikolsky',
        ],
        correctIndex: 0,
        themeIndex: 0,
        subthemeIndex: 0,
        groupIndex: 0,
      },
      {
        title:
          'Qual biológico é primeira linha para psoríase moderada a grave?',
        alternatives: ['Anti-TNF', 'Anti-IL17', 'Anti-IL23', 'Anti-IL4'],
        correctIndex: 1,
        themeIndex: 0,
        subthemeIndex: 0,
        groupIndex: 1,
      },
      {
        title: 'Qual é o critério diagnóstico maior para dermatite atópica?',
        alternatives: ['Prurido', 'Xerose', 'IgE elevada', 'Eosinofilia'],
        correctIndex: 0,
        themeIndex: 0,
        subthemeIndex: 1,
      },
      {
        title: 'Qual é o índice de Breslow para melanoma fino?',
        alternatives: ['< 1mm', '1-2mm', '2-4mm', '> 4mm'],
        correctIndex: 0,
        themeIndex: 1,
        subthemeIndex: 2,
        groupIndex: 2,
      },
      {
        title: 'Qual é o tipo histológico mais comum de CBC?',
        alternatives: [
          'Nodular',
          'Superficial',
          'Esclerodermiforme',
          'Micronodular',
        ],
        correctIndex: 0,
        themeIndex: 1,
        subthemeIndex: 3,
      },
      {
        title: 'Qual é o agente mais comum de tinea pedis?',
        alternatives: [
          'T. rubrum',
          'T. mentagrophytes',
          'E. floccosum',
          'M. canis',
        ],
        correctIndex: 0,
        themeIndex: 2,
        subthemeIndex: 4,
      },
      {
        title: 'Qual é o bacilo causador da hanseníase?',
        alternatives: [
          'M. leprae',
          'M. tuberculosis',
          'M. avium',
          'M. ulcerans',
        ],
        correctIndex: 0,
        themeIndex: 2,
        subthemeIndex: 5,
      },
    ],
    pricingPlan: {
      name: 'Plano Anual DermaQBank 2026',
      badge: 'NOVO',
      price: 'R$ 349,90',
      productId: 'dermaqbank_2026',
    },
  },
  {
    slug: 'cardio',
    name: 'CardioQBank',
    domain: 'cardio.ortoqbank.com',
    description:
      'Preparatório para o TEC - Título de Especialista em Cardiologia',
    isActive: true,
    themes: [
      { name: 'Insuficiência Cardíaca', prefix: 'IC', displayOrder: 1 },
      { name: 'Arritmias', prefix: 'ARR', displayOrder: 2 },
      { name: 'Doença Arterial Coronariana', prefix: 'DAC', displayOrder: 3 },
    ],
    subthemes: [
      {
        name: 'IC com Fração de Ejeção Reduzida',
        prefix: 'ICFER',
        themeIndex: 0,
      },
      {
        name: 'IC com Fração de Ejeção Preservada',
        prefix: 'ICFEP',
        themeIndex: 0,
      },
      { name: 'Fibrilação Atrial', prefix: 'FA', themeIndex: 1 },
      { name: 'Taquicardia Ventricular', prefix: 'TV', themeIndex: 1 },
      { name: 'Síndrome Coronariana Aguda', prefix: 'SCA', themeIndex: 2 },
      { name: 'Doença Coronariana Crônica', prefix: 'DCC', themeIndex: 2 },
    ],
    groups: [
      { name: 'Diagnóstico', prefix: 'DG', subthemeIndex: 0 },
      { name: 'Tratamento Medicamentoso', prefix: 'TM', subthemeIndex: 0 },
      { name: 'Anticoagulação', prefix: 'AC', subthemeIndex: 2 },
    ],
    questionTemplates: [
      {
        title: 'Qual é o critério de FE para ICFER?',
        alternatives: ['FE < 40%', 'FE 40-49%', 'FE ≥ 50%', 'FE > 55%'],
        correctIndex: 0,
        themeIndex: 0,
        subthemeIndex: 0,
        groupIndex: 0,
      },
      {
        title: 'Qual medicamento reduziu mortalidade em ICFER?',
        alternatives: [
          'IECA',
          'Betabloqueador',
          'iSGLT2',
          'Todos os anteriores',
        ],
        correctIndex: 3,
        themeIndex: 0,
        subthemeIndex: 0,
        groupIndex: 1,
      },
      {
        title: 'Qual é o tratamento diurético de escolha em ICFEP?',
        alternatives: [
          'Furosemida',
          'Hidroclorotiazida',
          'Espironolactona',
          'Indapamida',
        ],
        correctIndex: 0,
        themeIndex: 0,
        subthemeIndex: 1,
      },
      {
        title: 'Qual escore é usado para anticoagulação em FA?',
        alternatives: ['CHA2DS2-VASc', 'GRACE', 'TIMI', 'HEART'],
        correctIndex: 0,
        themeIndex: 1,
        subthemeIndex: 2,
        groupIndex: 2,
      },
      {
        title: 'Qual é o tratamento de escolha para TV monomórfica estável?',
        alternatives: [
          'Amiodarona',
          'Lidocaína',
          'Cardioversão',
          'Desfibrilação',
        ],
        correctIndex: 0,
        themeIndex: 1,
        subthemeIndex: 3,
      },
      {
        title: 'Qual é o biomarcador de necrose miocárdica?',
        alternatives: ['Troponina', 'BNP', 'PCR', 'D-dímero'],
        correctIndex: 0,
        themeIndex: 2,
        subthemeIndex: 4,
      },
      {
        title: 'Qual é a meta de LDL para prevenção secundária?',
        alternatives: [
          '< 70 mg/dL',
          '< 100 mg/dL',
          '< 130 mg/dL',
          '< 160 mg/dL',
        ],
        correctIndex: 0,
        themeIndex: 2,
        subthemeIndex: 5,
      },
    ],
    pricingPlan: {
      name: 'Plano Anual CardioQBank 2026',
      badge: 'NOVO',
      price: 'R$ 379,90',
      productId: 'cardioqbank_2026',
    },
  },
];

// Type for tenant config
type TenantConfig = (typeof TENANTS)[number];

// Generate questions for a tenant
function generateQuestionsForTenant(
  tenantConfig: TenantConfig,
  themeIds: Id<'themes'>[],
  subthemeIds: Id<'subthemes'>[],
  groupIds: Id<'groups'>[],
  tenantId: Id<'apps'>,
) {
  const questions: Array<{
    title: string;
    questionText: string;
    explanationText: string;
    alternatives: string[];
    correctAlternativeIndex: number;
    themeId: Id<'themes'>;
    subthemeId: Id<'subthemes'>;
    groupId?: Id<'groups'>;
    tenantId: Id<'apps'>;
  }> = [];

  // Generate base questions from tenant's templates
  for (const template of tenantConfig.questionTemplates) {
    const questionText = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: template.title }],
        },
      ],
    });

    const explanationText = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: `A resposta correta é "${template.alternatives[template.correctIndex]}".`,
            },
          ],
        },
      ],
    });

    questions.push({
      title: template.title,
      questionText,
      explanationText,
      alternatives: template.alternatives,
      correctAlternativeIndex: template.correctIndex,
      themeId: themeIds[template.themeIndex],
      subthemeId: subthemeIds[template.subthemeIndex],
      groupId:
        template.groupIndex === undefined
          ? undefined
          : groupIds[template.groupIndex],
      tenantId,
    });
  }

  // Generate additional questions (~20 per tenant) by creating variations
  for (let i = 0; i < 20; i++) {
    const baseTemplate =
      tenantConfig.questionTemplates[i % tenantConfig.questionTemplates.length];
    const variant = Math.floor(i / tenantConfig.questionTemplates.length) + 1;
    const title = `${baseTemplate.title} (Variação ${variant})`;

    const questionText = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: title }] },
      ],
    });

    const explanationText = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Explicação detalhada da questão.' }],
        },
      ],
    });

    questions.push({
      title,
      questionText,
      explanationText,
      alternatives: ['Opção A', 'Opção B', 'Opção C', 'Opção D'],
      correctAlternativeIndex: i % 4,
      themeId: themeIds[baseTemplate.themeIndex],
      subthemeId: subthemeIds[baseTemplate.subthemeIndex],
      tenantId,
    });
  }

  return questions;
}

// ============================================================
// MAIN SEED FUNCTION - Seeds all 3 tenants
// ============================================================

export const seed = internalMutation({
  args: { force: v.optional(v.boolean()) },
  returns: v.object({
    message: v.string(),
    created: v.object({
      apps: v.number(),
      themes: v.number(),
      subthemes: v.number(),
      groups: v.number(),
      questions: v.number(),
      presetQuizzes: v.number(),
      pricingPlans: v.number(),
    }),
    tenantIds: v.array(v.id('apps')),
  }),
  handler: async (ctx, args) => {
    // PRODUCTION SAFETY CHECK - only block if explicitly production env
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction && !args.force) {
      throw new Error(
        'SAFETY: This seeding function is blocked in production. ' +
          'If you really need to run this, set force=true, but this is DANGEROUS!',
      );
    }

    // Check if any tenant already exists
    const existingApp = await ctx.db
      .query('apps')
      .withIndex('by_slug', q => q.eq('slug', TENANTS[0].slug))
      .first();

    if (existingApp && !args.force) {
      return {
        message: 'Database already has data. Use force=true to override.',
        created: {
          apps: 0,
          themes: 0,
          subthemes: 0,
          groups: 0,
          questions: 0,
          presetQuizzes: 0,
          pricingPlans: 0,
        },
        tenantIds: [],
      };
    }

    console.log(`Starting multi-tenant seed for ${TENANTS.length} tenants...`);

    const totals = {
      apps: 0,
      themes: 0,
      subthemes: 0,
      groups: 0,
      questions: 0,
      presetQuizzes: 0,
      pricingPlans: 0,
    };
    const tenantIds: Id<'apps'>[] = [];

    // Seed each tenant
    for (const tenantConfig of TENANTS) {
      console.log(`\n--- Seeding tenant: ${tenantConfig.name} ---`);

      // 1. Create the tenant/app
      const tenantId = await ctx.db.insert('apps', {
        slug: tenantConfig.slug,
        name: tenantConfig.name,
        domain: tenantConfig.domain,
        description: tenantConfig.description,
        isActive: tenantConfig.isActive,
        createdAt: Date.now(),
      });
      tenantIds.push(tenantId);
      totals.apps++;
      console.log(`Created tenant: ${tenantConfig.name}`);

      // 2. Create themes
      const themeIds: Id<'themes'>[] = [];
      for (const theme of tenantConfig.themes) {
        const themeId = await ctx.db.insert('themes', {
          tenantId,
          name: theme.name,
          prefix: theme.prefix,
          displayOrder: theme.displayOrder,
        });
        themeIds.push(themeId);
        totals.themes++;
      }
      console.log(`Created ${themeIds.length} themes`);

      // 3. Create subthemes
      const subthemeIds: Id<'subthemes'>[] = [];
      for (const subtheme of tenantConfig.subthemes) {
        const subthemeId = await ctx.db.insert('subthemes', {
          tenantId,
          name: subtheme.name,
          prefix: subtheme.prefix,
          themeId: themeIds[subtheme.themeIndex],
        });
        subthemeIds.push(subthemeId);
        totals.subthemes++;
      }
      console.log(`Created ${subthemeIds.length} subthemes`);

      // 4. Create groups
      const groupIds: Id<'groups'>[] = [];
      for (const group of tenantConfig.groups) {
        const groupId = await ctx.db.insert('groups', {
          tenantId,
          name: group.name,
          prefix: group.prefix,
          subthemeId: subthemeIds[group.subthemeIndex],
        });
        groupIds.push(groupId);
        totals.groups++;
      }
      console.log(`Created ${groupIds.length} groups`);

      // 5. Create questions
      const questionsData = generateQuestionsForTenant(
        tenantConfig,
        themeIds,
        subthemeIds,
        groupIds,
        tenantId,
      );
      const questionIds: Id<'questions'>[] = [];
      let questionIndex = 0;

      for (const q of questionsData) {
        const orderedNumberId = questionIndex + 1;
        const questionCode = `${tenantConfig.slug.toUpperCase()}-Q${String(orderedNumberId).padStart(4, '0')}`;

        const questionId = await ctx.db.insert('questions', {
          tenantId,
          title: q.title,
          normalizedTitle: q.title.toLowerCase().trim(),
          questionCode,
          orderedNumberId,
          questionText: q.questionText,
          explanationText: q.explanationText,
          questionTextString: q.questionText,
          explanationTextString: q.explanationText,
          alternatives: q.alternatives,
          correctAlternativeIndex: q.correctAlternativeIndex,
          themeId: q.themeId,
          subthemeId: q.subthemeId,
          groupId: q.groupId,
          isPublic: true,
          contentMigrated: true,
        });
        questionIds.push(questionId);
        questionIndex++;
        totals.questions++;
      }
      console.log(`Created ${questionIds.length} questions`);

      // 6. Create preset quizzes (trilhas) - one per subtheme
      let tenantPresetQuizzes = 0;

      for (const [subthemeIdx, subtheme] of tenantConfig.subthemes.entries()) {
        const currentSubthemeId = subthemeIds[subthemeIdx];
        const subthemeQuestions = questionsData
          .map((qData, idx) => ({ qData, idx }))
          .filter(({ qData }) => qData.subthemeId === currentSubthemeId)
          .slice(0, 10)
          .map(({ idx }) => questionIds[idx]);

        if (subthemeQuestions.length > 0) {
          await ctx.db.insert('presetQuizzes', {
            tenantId,
            name: subtheme.name,
            description: `Trilha de estudo: ${subtheme.name}`,
            category: 'trilha',
            themeId: themeIds[subtheme.themeIndex],
            subthemeId: currentSubthemeId,
            questions: subthemeQuestions,
            isPublic: true,
            displayOrder: subthemeIdx + 1,
          });
          tenantPresetQuizzes++;
          totals.presetQuizzes++;
        }
      }

      // Add one simulado per tenant
      const shuffledQuestions = [...questionIds]
        .toSorted(() => Math.random() - 0.5)
        .slice(0, 20);
      await ctx.db.insert('presetQuizzes', {
        tenantId,
        name: `Simulado ${tenantConfig.slug.toUpperCase()}`,
        description: `Simulado completo de ${tenantConfig.name}`,
        category: 'simulado',
        subcategory: tenantConfig.slug.toUpperCase(),
        questions: shuffledQuestions,
        isPublic: true,
        displayOrder: 1,
      });
      tenantPresetQuizzes++;
      totals.presetQuizzes++;
      console.log(`Created ${tenantPresetQuizzes} preset quizzes`);

      // 7. Create pricing plan
      await ctx.db.insert('pricingPlans', {
        tenantId,
        name: tenantConfig.pricingPlan.name,
        badge: tenantConfig.pricingPlan.badge,
        originalPrice: 'R$ 499,90',
        price: tenantConfig.pricingPlan.price,
        installments: '12x sem juros',
        installmentDetails: 'ou à vista com 10% de desconto',
        description: `Acesso completo ao ${tenantConfig.name} por 1 ano`,
        features: [
          'Acesso a todas as questões',
          'Trilhas de estudo',
          'Simulados',
          'Estatísticas',
        ],
        buttonText: 'Assinar Agora',
        productId: tenantConfig.pricingPlan.productId,
        category: 'year_access' as const,
        year: 2026,
        regularPriceNum: 39_990,
        pixPriceNum: 35_990,
        accessYears: [2026],
        isActive: true,
        displayOrder: 1,
      });
      totals.pricingPlans++;
      console.log(`Created 1 pricing plan`);
    }

    console.log('\n=== Seed completed successfully! ===');
    console.log(
      `Created ${totals.apps} tenants, ${totals.questions} questions total`,
    );

    return {
      message: `Database seeded with ${TENANTS.length} tenants`,
      created: totals,
      tenantIds,
    };
  },
});

// ============================================================
// CLEAR SEED DATA
// ============================================================

export const clearSeedData = internalMutation({
  args: { tenantSlug: v.optional(v.string()), force: v.optional(v.boolean()) },
  returns: v.object({ message: v.string() }),
  handler: async (ctx, args) => {
    // PRODUCTION SAFETY CHECK - only block if explicitly production env
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction && !args.force) {
      throw new Error(
        'SAFETY: This clear function is blocked in production! Use force=true to override.',
      );
    }

    const slug = args.tenantSlug || 'teot';
    console.log(`Clearing seed data for tenant: ${slug}...`);

    // Find the tenant
    const tenant = await ctx.db
      .query('apps')
      .withIndex('by_slug', q => q.eq('slug', slug))
      .first();

    if (!tenant) {
      return { message: `Tenant "${slug}" not found` };
    }

    // Delete in reverse order of dependencies
    const presetQuizzes = await ctx.db
      .query('presetQuizzes')
      .withIndex('by_tenant', q => q.eq('tenantId', tenant._id))
      .collect();
    for (const q of presetQuizzes) await ctx.db.delete(q._id);

    const questions = await ctx.db
      .query('questions')
      .withIndex('by_tenant', q => q.eq('tenantId', tenant._id))
      .collect();
    for (const q of questions) await ctx.db.delete(q._id);

    const groups = await ctx.db
      .query('groups')
      .withIndex('by_tenant', q => q.eq('tenantId', tenant._id))
      .collect();
    for (const g of groups) await ctx.db.delete(g._id);

    const subthemes = await ctx.db
      .query('subthemes')
      .withIndex('by_tenant', q => q.eq('tenantId', tenant._id))
      .collect();
    for (const s of subthemes) await ctx.db.delete(s._id);

    const themes = await ctx.db
      .query('themes')
      .withIndex('by_tenant', q => q.eq('tenantId', tenant._id))
      .collect();
    for (const t of themes) await ctx.db.delete(t._id);

    const pricingPlans = await ctx.db
      .query('pricingPlans')
      .withIndex('by_tenant', q => q.eq('tenantId', tenant._id))
      .collect();
    for (const p of pricingPlans) await ctx.db.delete(p._id);

    // Delete the tenant itself
    await ctx.db.delete(tenant._id);

    console.log(
      `Cleared: ${questions.length} questions, ${themes.length} themes, ${presetQuizzes.length} quizzes`,
    );
    return { message: `Seed data cleared for tenant "${slug}"` };
  },
});

// Clear ALL seed data (all tenants)
export const clearAllSeedData = internalMutation({
  args: { force: v.optional(v.boolean()) },
  returns: v.object({ message: v.string(), deletedTenants: v.number() }),
  handler: async (ctx, args) => {
    // PRODUCTION SAFETY CHECK - only block if explicitly production env
    // Dev deployments on convex.cloud are OK
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction && !args.force) {
      throw new Error(
        'SAFETY: This clear function is blocked in production! Use force=true to override.',
      );
    }

    console.log('Clearing ALL seed data...');

    let deletedTenants = 0;

    for (const tenantConfig of TENANTS) {
      const tenant = await ctx.db
        .query('apps')
        .withIndex('by_slug', q => q.eq('slug', tenantConfig.slug))
        .first();
      if (!tenant) continue;

      // Delete in reverse order of dependencies
      const presetQuizzes = await ctx.db
        .query('presetQuizzes')
        .withIndex('by_tenant', q => q.eq('tenantId', tenant._id))
        .collect();
      for (const q of presetQuizzes) await ctx.db.delete(q._id);

      const questions = await ctx.db
        .query('questions')
        .withIndex('by_tenant', q => q.eq('tenantId', tenant._id))
        .collect();
      for (const q of questions) await ctx.db.delete(q._id);

      const groups = await ctx.db
        .query('groups')
        .withIndex('by_tenant', q => q.eq('tenantId', tenant._id))
        .collect();
      for (const g of groups) await ctx.db.delete(g._id);

      const subthemes = await ctx.db
        .query('subthemes')
        .withIndex('by_tenant', q => q.eq('tenantId', tenant._id))
        .collect();
      for (const s of subthemes) await ctx.db.delete(s._id);

      const themes = await ctx.db
        .query('themes')
        .withIndex('by_tenant', q => q.eq('tenantId', tenant._id))
        .collect();
      for (const t of themes) await ctx.db.delete(t._id);

      const pricingPlans = await ctx.db
        .query('pricingPlans')
        .withIndex('by_tenant', q => q.eq('tenantId', tenant._id))
        .collect();
      for (const p of pricingPlans) await ctx.db.delete(p._id);

      await ctx.db.delete(tenant._id);
      deletedTenants++;
      console.log(`Deleted tenant: ${tenantConfig.slug}`);
    }

    return { message: `Cleared ${deletedTenants} tenants`, deletedTenants };
  },
});

// ============================================================
// SEED USER STATS (for testing user data)
// ============================================================

export const seedUserStats = internalMutation({
  args: {
    userId: v.id('users'),
    tenantId: v.id('apps'),
    answeredCount: v.number(),
    correctPercentage: v.number(),
    bookmarkedCount: v.number(),
  },
  returns: v.object({
    message: v.string(),
    created: v.object({
      answered: v.number(),
      correct: v.number(),
      incorrect: v.number(),
      bookmarked: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    console.log(`Seeding user stats for user ${args.userId}...`);

    // Get questions for this tenant
    const questions = await ctx.db
      .query('questions')
      .withIndex('by_tenant', q => q.eq('tenantId', args.tenantId))
      .collect();

    if (questions.length === 0) {
      throw new Error('No questions found for this tenant. Run seed first.');
    }

    // Shuffle and select questions
    const shuffled = [...questions].toSorted(() => Math.random() - 0.5);
    const answeredCount = Math.min(args.answeredCount, shuffled.length);
    const correctCount = Math.floor(
      answeredCount * (args.correctPercentage / 100),
    );
    const incorrectCount = answeredCount - correctCount;

    const answeredQuestions = shuffled.slice(0, answeredCount);
    const correctQuestions = answeredQuestions.slice(0, correctCount);
    const incorrectQuestions = answeredQuestions.slice(correctCount);

    // Create answer stats
    for (const q of correctQuestions) {
      await ctx.db.insert('userQuestionStats', {
        tenantId: args.tenantId,
        userId: args.userId,
        questionId: q._id,
        hasAnswered: true,
        isIncorrect: false,
        answeredAt: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
        themeId: q.themeId,
        subthemeId: q.subthemeId,
        groupId: q.groupId,
      });
    }

    for (const q of incorrectQuestions) {
      await ctx.db.insert('userQuestionStats', {
        tenantId: args.tenantId,
        userId: args.userId,
        questionId: q._id,
        hasAnswered: true,
        isIncorrect: true,
        answeredAt: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
        themeId: q.themeId,
        subthemeId: q.subthemeId,
        groupId: q.groupId,
      });
    }

    // Create bookmarks
    const bookmarkCount = Math.min(args.bookmarkedCount, shuffled.length);
    const bookmarkedQuestions = shuffled.slice(0, bookmarkCount);
    let createdBookmarks = 0;

    for (const q of bookmarkedQuestions) {
      const existing = await ctx.db
        .query('userBookmarks')
        .withIndex('by_user_question', qb =>
          qb.eq('userId', args.userId).eq('questionId', q._id),
        )
        .first();

      if (!existing) {
        await ctx.db.insert('userBookmarks', {
          tenantId: args.tenantId,
          userId: args.userId,
          questionId: q._id,
          themeId: q.themeId,
          subthemeId: q.subthemeId,
          groupId: q.groupId,
        });
        createdBookmarks++;
      }
    }

    console.log(
      `Created ${answeredCount} answer stats, ${createdBookmarks} bookmarks`,
    );

    return {
      message: 'User stats seeded successfully',
      created: {
        answered: answeredCount,
        correct: correctCount,
        incorrect: incorrectCount,
        bookmarked: createdBookmarks,
      },
    };
  },
});

// ============================================================
// CLEAR USER STATS
// ============================================================

export const clearUserStats = internalMutation({
  args: { userId: v.id('users'), tenantId: v.optional(v.id('apps')) },
  returns: v.object({ message: v.string() }),
  handler: async (ctx, args) => {
    // Delete userQuestionStats
    const statsQuery = args.tenantId
      ? ctx.db
          .query('userQuestionStats')
          .withIndex('by_tenant_and_user', q =>
            q.eq('tenantId', args.tenantId).eq('userId', args.userId),
          )
      : ctx.db
          .query('userQuestionStats')
          .withIndex('by_user', q => q.eq('userId', args.userId));

    const stats = await statsQuery.collect();
    for (const s of stats) await ctx.db.delete(s._id);
    console.log(`Deleted ${stats.length} userQuestionStats`);

    // Delete userBookmarks
    const bookmarksQuery = args.tenantId
      ? ctx.db
          .query('userBookmarks')
          .withIndex('by_tenant_and_user', q =>
            q.eq('tenantId', args.tenantId).eq('userId', args.userId),
          )
      : ctx.db
          .query('userBookmarks')
          .withIndex('by_user', q => q.eq('userId', args.userId));

    const bookmarks = await bookmarksQuery.collect();
    for (const b of bookmarks) await ctx.db.delete(b._id);
    console.log(`Deleted ${bookmarks.length} userBookmarks`);

    // Delete userStatsCounts
    const countsQuery = args.tenantId
      ? ctx.db
          .query('userStatsCounts')
          .withIndex('by_tenant_and_user', q =>
            q.eq('tenantId', args.tenantId).eq('userId', args.userId),
          )
      : ctx.db
          .query('userStatsCounts')
          .withIndex('by_user', q => q.eq('userId', args.userId));

    const counts = await countsQuery.collect();
    for (const c of counts) await ctx.db.delete(c._id);
    console.log(`Deleted ${counts.length} userStatsCounts`);

    return { message: 'User stats cleared' };
  },
});

export default seed;
