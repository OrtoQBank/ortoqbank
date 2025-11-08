import { z } from 'zod';

import { Id } from '../../../../../../convex/_generated/dataModel';

// Define base schema without refine for proper type inference
const questionSchemaBase = z.object({
  title: z.string().min(1, 'O título é obrigatório'),
  questionCode: z.string().optional(),
  questionTextString: z.string(),
  alternatives: z
    .array(z.string())
    .min(2, 'Deve haver pelo menos 2 alternativas')
    .max(6, 'Deve haver no máximo 6 alternativas')
    .refine(
      (alternatives) => alternatives.every((alt) => alt.trim().length > 0),
      'Todas as alternativas devem ser preenchidas'
    ),

  correctAlternativeIndex: z.number({
    required_error: 'Selecione a alternativa correta',
    invalid_type_error: 'Selecione a alternativa correta',
  }).min(0, 'Selecione a alternativa correta'),
  explanationTextString: z.string(),
  themeId: z.string().min(1, 'O tema é obrigatório'),
  subthemeId: z.string().optional(),
  groupId: z.string().optional(),
});

// Export with refine for validation
export const questionSchema = questionSchemaBase.refine(
  (data) => 
    typeof data.correctAlternativeIndex === 'number' && 
    data.correctAlternativeIndex >= 0 &&
    data.correctAlternativeIndex < data.alternatives.length,
  {
    message: 'Selecione a alternativa correta',
    path: ['correctAlternativeIndex'],
  },
);

export const themeSchema = z.object({
  name: z.string().min(3, 'Mínimo de 3 caracteres'),
});

export const subthemeSchema = z.object({
  name: z.string().min(1, 'O nome do subtema é obrigatório'),
  themeId: z.custom<Id<'themes'>>(),
});

// Infer type from base schema for better type compatibility
export type QuestionFormData = z.infer<typeof questionSchemaBase>;
export type ThemeFormData = z.infer<typeof themeSchema>;
export type SubthemeFormData = z.infer<typeof subthemeSchema>;
