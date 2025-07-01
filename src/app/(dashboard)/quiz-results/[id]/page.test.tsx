import { useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { useParams, useRouter } from 'next/navigation';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { render, screen } from '@/tests/react-test-utils';

import UniversalQuizResultsPage from './page';

// Mock all dependencies
vi.mock('next/navigation');
vi.mock('@clerk/nextjs');
vi.mock('convex/react');
vi.mock('@/components/quiz/QuestionContent', () => ({
  default: ({ stringContent }: { stringContent: string }) => (
    <div>{stringContent}</div>
  ),
}));
vi.mock('@/components/common/StructuredContentRenderer', () => ({
  default: ({ stringContent }: { stringContent: string }) => (
    <div>{stringContent}</div>
  ),
}));
vi.mock('@/components/quiz/QuizProgressResults', () => ({
  default: () => <div>Progress</div>,
}));
vi.mock('@/lib/utils', () => ({
  formatDate: () => '01/01/2024',
}));

describe('UniversalQuizResultsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup basic mocks
    vi.mocked(useRouter).mockReturnValue({ push: vi.fn() } as any);
    vi.mocked(useParams).mockReturnValue({ id: 'quiz123' });
    vi.mocked(useUser).mockReturnValue({ user: { id: 'user123' } } as any);
  });

  test('shows loading when no data', () => {
    vi.mocked(useQuery).mockImplementation(() => {});

    render(<UniversalQuizResultsPage />);

    expect(screen.getByText('Carregando resultados...')).toBeInTheDocument();
  });

  test('displays quiz results', () => {
    const mockQuiz = {
      name: 'Test Quiz',
      questions: [
        {
          _id: 'q1',
          questionTextString: 'What is 2+2?',
          alternatives: ['2', '3', '4', '5'],
          correctAlternativeIndex: 2,
        },
      ],
    };

    const mockSession = [
      {
        _creationTime: 1_234_567_890,
        answers: [2],
        answerFeedback: [{ isCorrect: true, explanation: 'Correct!' }],
      },
    ];

    vi.mocked(useQuery)
      .mockReturnValueOnce(mockQuiz)
      .mockReturnValueOnce('skip')
      .mockReturnValueOnce(mockSession);

    render(<UniversalQuizResultsPage />);

    expect(screen.getByText('Test Quiz')).toBeInTheDocument();
    expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
  });
});
