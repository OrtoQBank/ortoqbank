'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  MotherDuckClientProvider,
  useMotherDuckClientState,
} from '@/lib/motherduck/context/motherduckClientContext';

const QUESTIONS_COUNT_QUERY = `
  SELECT COUNT(*) AS total_questions FROM my_db.main.questions;
`;

const useFetchQuestionsCount = () => {
  const { safeEvaluateQuery } = useMotherDuckClientState();
  const [error, setError] = useState<string | null>(null);

  const fetchQuestionsCount = useCallback(async () => {
    try {
      const safeResult = await safeEvaluateQuery(QUESTIONS_COUNT_QUERY);
      if (safeResult.status === 'success') {
        setError(null);
        const count =
          safeResult.result.data.toRows()?.[0]?.total_questions?.valueOf() ?? 0;
        return count;
      } else {
        setError(safeResult.err.message);
        return 0;
      }
    } catch (error) {
      setError('fetchQuestionsCount failed: ' + error);
      return 0;
    }
  }, [safeEvaluateQuery]);

  return { fetchQuestionsCount, error };
};

function QuestionsCountCard() {
  const { fetchQuestionsCount, error } = useFetchQuestionsCount();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [shouldThrowError, setShouldThrowError] = useState<boolean>(false);

  // This will trigger the error boundary during render
  if (shouldThrowError) {
    throw new Error('Test error for error boundary - thrown during render');
  }

  const loadData = async () => {
    setLoading(true);
    const result = await fetchQuestionsCount();
    setCount(Number(result));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [fetchQuestionsCount]);

  return (
    <div className="p-6">
      <p className="mb-2 text-xl font-semibold">Total Questions</p>
      {error && <p className="text-red-500">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <p className="text-2xl font-bold">{count}</p>
      )}
      <div className="mt-4 space-x-2">
        <button
          onClick={loadData}
          className="rounded bg-gray-200 px-4 py-2 hover:bg-gray-300"
        >
          Refresh
        </button>
        <button
          onClick={() => setShouldThrowError(true)}
          className="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600"
        >
          Test Error Boundary
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <MotherDuckClientProvider>
      <QuestionsCountCard />
    </MotherDuckClientProvider>
  );
}
