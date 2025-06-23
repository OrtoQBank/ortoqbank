import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Configuration
const QUESTIONS_TO_GENERATE = 50;

// Question templates for variety
const QUESTION_TEMPLATES = [
  "Qual é {concept} em {area}?",
  "Como se caracteriza {condition} na {region}?",
  "Qual é o tratamento indicado para {pathology}?",
  "Qual é a classificação de {classification_system}?",
  "Qual é o diagnóstico diferencial de {symptom}?",
  "Qual é a técnica cirúrgica para {procedure}?",
  "Qual é a anatomia de {structure}?",
  "Qual é a biomecânica de {movement}?",
  "Qual é a fisiopatologia de {disease}?",
  "Qual é a indicação para {treatment}?"
];

const MEDICAL_CONCEPTS = [
  "a articulação mais móvel", "o osso mais resistente", "o ligamento mais importante",
  "a fratura mais comum", "a lesão mais grave", "o músculo mais forte",
  "a deformidade congênita", "a patologia degenerativa", "o trauma mais frequente",
  "a complicação mais séria"
];

const MEDICAL_AREAS = [
  "ortopedia", "traumatologia", "cirurgia do joelho", "cirurgia da coluna",
  "ortopedia pediátrica", "medicina esportiva", "cirurgia do quadril",
  "cirurgia da mão", "cirurgia do ombro", "cirurgia do pé"
];

const ALTERNATIVES_POOL = [
  "Opção A", "Opção B", "Opção C", "Opção D",
  "Alternativa 1", "Alternativa 2", "Alternativa 3", "Alternativa 4",
  "Primeira opção", "Segunda opção", "Terceira opção", "Quarta opção"
];

// Function to generate random questions
function generateQuestions(count: number) {
  const questions = [];
  
  for (let i = 0; i < count; i++) {
    const templateIndex = i % QUESTION_TEMPLATES.length;
    const conceptIndex = i % MEDICAL_CONCEPTS.length;
    const areaIndex = i % MEDICAL_AREAS.length;
    
    const template = QUESTION_TEMPLATES[templateIndex];
    const concept = MEDICAL_CONCEPTS[conceptIndex];
    const area = MEDICAL_AREAS[areaIndex];
    
    // Replace placeholders in template
    let questionTitle = template
      .replace("{concept}", concept)
      .replace("{area}", area)
      .replace("{condition}", `condição ${i + 1}`)
      .replace("{region}", `região ${i + 1}`)
      .replace("{pathology}", `patologia ${i + 1}`)
      .replace("{classification_system}", `sistema ${i + 1}`)
      .replace("{symptom}", `sintoma ${i + 1}`)
      .replace("{procedure}", `procedimento ${i + 1}`)
      .replace("{structure}", `estrutura ${i + 1}`)
      .replace("{movement}", `movimento ${i + 1}`)
      .replace("{disease}", `doença ${i + 1}`)
      .replace("{treatment}", `tratamento ${i + 1}`);

    const questionText = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: questionTitle }
          ]
        }
      ]
    });

    const explanation = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: `Explicação para a questão ${i + 1}: Esta é uma explicação placeholder que descreve o conceito médico relacionado à pergunta sobre ${concept} em ${area}.` }
          ]
        }
      ]
    });

    const alternatives = [
      `${ALTERNATIVES_POOL[0]} - Resposta ${i + 1}A`,
      `${ALTERNATIVES_POOL[1]} - Resposta ${i + 1}B`,
      `${ALTERNATIVES_POOL[2]} - Resposta ${i + 1}C`,
      `${ALTERNATIVES_POOL[3]} - Resposta ${i + 1}D`
    ];

    const correctAlternativeIndex = i % 4; // Rotate correct answers

    // Distribute questions across themes/subthemes/groups
    const themeIndex = i % 5; // 5 themes
    const subthemeIndex = (i % 15); // 15 subthemes total
    const groupIndex = (i % 12); // 12 groups total

    questions.push({
      title: questionTitle,
      questionText,
      explanation,
      alternatives,
      correctAlternativeIndex,
      questionCode: `Q${String(i + 1).padStart(3, '0')}`,
      themeIndex,
      subthemeIndex,
      groupIndex
    });
  }
  
  return questions;
}

// Sample data structure
const SEED_DATA = {
  themes: [
    { name: "Ortopedia Básica", prefix: "ORT" },
    { name: "Traumatologia", prefix: "TRA" },
    { name: "Cirurgia do Joelho", prefix: "JOE" },
    { name: "Cirurgia da Coluna", prefix: "COL" },
    { name: "Ortopedia Pediátrica", prefix: "PED" },
  ],
  subthemes: [
    // Ortopedia Básica subthemes
    { name: "Anatomia Básica", prefix: "AB", themeIndex: 0 },
    { name: "Biomecânica", prefix: "BM", themeIndex: 0 },
    { name: "Patologia Básica", prefix: "PB", themeIndex: 0 },
    
    // Traumatologia subthemes
    { name: "Fraturas", prefix: "FR", themeIndex: 1 },
    { name: "Luxações", prefix: "LX", themeIndex: 1 },
    { name: "Lesões de Partes Moles", prefix: "PM", themeIndex: 1 },
    
    // Cirurgia do Joelho subthemes
    { name: "Menisco", prefix: "ME", themeIndex: 2 },
    { name: "Ligamentos", prefix: "LI", themeIndex: 2 },
    { name: "Cartilagem", prefix: "CA", themeIndex: 2 },
    
    // Cirurgia da Coluna subthemes
    { name: "Cervical", prefix: "CE", themeIndex: 3 },
    { name: "Torácica", prefix: "TO", themeIndex: 3 },
    { name: "Lombar", prefix: "LO", themeIndex: 3 },
    
    // Ortopedia Pediátrica subthemes
    { name: "Deformidades Congênitas", prefix: "DC", themeIndex: 4 },
    { name: "Displasia do Quadril", prefix: "DQ", themeIndex: 4 },
    { name: "Pé Torto Congênito", prefix: "PC", themeIndex: 4 },
  ],
  groups: [
    // Anatomia Básica groups
    { name: "Ossos", prefix: "O", subthemeIndex: 0 },
    { name: "Articulações", prefix: "A", subthemeIndex: 0 },
    { name: "Músculos", prefix: "M", subthemeIndex: 0 },
    
    // Biomecânica groups
    { name: "Forças", prefix: "F", subthemeIndex: 1 },
    { name: "Momentos", prefix: "M", subthemeIndex: 1 },
    
    // Patologia Básica groups
    { name: "Inflamação", prefix: "I", subthemeIndex: 2 },
    { name: "Degeneração", prefix: "D", subthemeIndex: 2 },
    
    // Fraturas groups
    { name: "Classificação", prefix: "C", subthemeIndex: 3 },
    { name: "Tratamento", prefix: "T", subthemeIndex: 3 },
    { name: "Complicações", prefix: "C", subthemeIndex: 3 },
    
    // Menisco groups
    { name: "Lesões Traumáticas", prefix: "T", subthemeIndex: 6 },
    { name: "Lesões Degenerativas", prefix: "D", subthemeIndex: 6 },
  ],
  questions: generateQuestions(QUESTIONS_TO_GENERATE)
};

const seedDatabase = internalMutation({
  args: {},
  returns: v.object({
    message: v.string(),
    created: v.object({
      themes: v.number(),
      subthemes: v.number(),
      groups: v.number(),
      questions: v.number()
    })
  }),
  handler: async (ctx, args) => {
    // Check if data already exists to make this idempotent
    const existingThemes = await ctx.db.query("themes").collect();
    if (existingThemes.length > 0) {
      return {
        message: "Database already seeded, skipping initialization",
        created: {
          themes: 0,
          subthemes: 0,
          groups: 0,
          questions: 0
        }
      };
    }

    console.log("Starting database seeding...");

    // Create themes
    const createdThemes: Id<"themes">[] = [];
    for (const themeData of SEED_DATA.themes) {
      const themeId = await ctx.db.insert("themes", {
        name: themeData.name,
        prefix: themeData.prefix,
        displayOrder: createdThemes.length + 1
      });
      createdThemes.push(themeId);
      console.log(`Created theme: ${themeData.name}`);
    }

    // Create subthemes
    const createdSubthemes: Id<"subthemes">[] = [];
    for (const subthemeData of SEED_DATA.subthemes) {
      const subthemeId = await ctx.db.insert("subthemes", {
        name: subthemeData.name,
        prefix: subthemeData.prefix,
        themeId: createdThemes[subthemeData.themeIndex]
      });
      createdSubthemes.push(subthemeId);
      console.log(`Created subtheme: ${subthemeData.name}`);
    }

    // Create groups
    const createdGroups: Id<"groups">[] = [];
    for (const groupData of SEED_DATA.groups) {
      const groupId = await ctx.db.insert("groups", {
        name: groupData.name,
        prefix: groupData.prefix,
        subthemeId: createdSubthemes[groupData.subthemeIndex]
      });
      createdGroups.push(groupId);
      console.log(`Created group: ${groupData.name}`);
    }

    // Create questions
    let createdQuestionsCount = 0;
    for (const questionData of SEED_DATA.questions) {
      const questionId = await ctx.db.insert("questions", {
        title: questionData.title,
        normalizedTitle: questionData.title.toLowerCase().trim(),
        questionCode: questionData.questionCode,
        questionText: questionData.questionText,
        explanationText: questionData.explanation,
        questionTextString: JSON.parse(questionData.questionText).content[0].content[0].text,
        explanationTextString: JSON.parse(questionData.explanation).content[0].content[0].text,
        alternatives: questionData.alternatives,
        correctAlternativeIndex: questionData.correctAlternativeIndex,
        themeId: createdThemes[questionData.themeIndex],
        subthemeId: createdSubthemes[questionData.subthemeIndex],
        groupId: createdGroups[questionData.groupIndex],
        isPublic: true,
        contentMigrated: true
      });
      createdQuestionsCount++;
      console.log(`Created question: ${questionData.title}`);
    }

    console.log("Database seeding completed successfully!");

    return {
      message: "Database seeded successfully",
      created: {
        themes: createdThemes.length,
        subthemes: createdSubthemes.length,
        groups: createdGroups.length,
        questions: createdQuestionsCount
      }
    };
  },
});

// Export as default so it can be called with `npx convex run init`
export default seedDatabase; 