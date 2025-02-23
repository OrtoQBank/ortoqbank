import { z } from 'zod';

import { Id } from '../../../../../../convex/_generated/dataModel';

export const questionSchema = z.object({
  title: z.string().min(1, 'O título é obrigatório'),
  questionText: z.any(),
  alternatives: z
    .array(z.string())
    .length(4, 'Deve haver exatamente 4 alternativas')
    .refine(
      alternatives => new Set(alternatives).size === alternatives.length,
      'As alternativas não podem ser repetidas',
    ),
  correctAlternativeIndex: z.number().min(0).max(3),
  explanationText: z.any(),
  themeId: z.string().min(1, 'O tema é obrigatório'),
  subthemeId: z.string().optional(),
  groupId: z.string().optional(),
});

export const themeSchema = z.object({
  name: z.string().min(3, 'Mínimo de 3 caracteres'),
});

export const subthemeSchema = z.object({
  name: z.string().min(1, 'O nome do subtema é obrigatório'),
  themeId: z.custom<Id<'themes'>>(),
});

export type QuestionFormData = z.infer<typeof questionSchema>;
export type ThemeFormData = z.infer<typeof themeSchema>;
export type SubthemeFormData = z.infer<typeof subthemeSchema>;
