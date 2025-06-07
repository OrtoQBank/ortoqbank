import { z } from 'zod';

export const formSchema = z.object({
  mode: z.enum(['exam', 'study'], {
    required_error: 'Modo é obrigatório',
  }),
  filter: z.enum(['all', 'unanswered', 'incorrect', 'bookmarked'], {
    required_error: 'Filtro é obrigatório',
  }),
  taxonomySelection: z.array(z.any()).default([]),
  totalQuestions: z.coerce
    .number()
    .min(1, 'Mínimo de 1 questão')
    .max(200, 'Máximo de 200 questões')
    .default(20),
});

export type FormData = z.infer<typeof formSchema>;
