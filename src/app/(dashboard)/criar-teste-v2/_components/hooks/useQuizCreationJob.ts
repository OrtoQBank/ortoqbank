'use client';

import { useQuery } from 'convex/react';
import { useCallback, useEffect, useState } from 'react';

import { api } from '../../../../../../convex/_generated/api';
import { Id } from '../../../../../../convex/_generated/dataModel';

interface JobStatus {
  _id: Id<'quizCreationJobs'>;
  status: string;
  progress: number;
  progressMessage?: string;
  quizId?: Id<'customQuizzes'>;
  questionCount?: number;
  error?: string;
  errorMessage?: string;
}

interface UseQuizCreationJobResult {
  jobId: Id<'quizCreationJobs'> | null;
  jobStatus: JobStatus | null;
  isActive: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  startWatching: (id: Id<'quizCreationJobs'>) => void;
  reset: () => void;
}

/**
 * Hook to subscribe to quiz creation job progress
 */
export function useQuizCreationJob(): UseQuizCreationJobResult {
  const [jobId, setJobId] = useState<Id<'quizCreationJobs'> | null>(null);

  // Subscribe to job status updates
  const jobStatus = useQuery(
    api.customQuizWorkflow.getJobStatus,
    jobId ? { jobId } : 'skip'
  ) as JobStatus | null | undefined;

  const isActive =
    jobId !== null &&
    jobStatus !== null &&
    jobStatus !== undefined &&
    !['completed', 'failed'].includes(jobStatus.status);

  const isCompleted = jobStatus?.status === 'completed';
  const isFailed = jobStatus?.status === 'failed';

  const startWatching = useCallback((id: Id<'quizCreationJobs'>) => {
    setJobId(id);
  }, []);

  const reset = useCallback(() => {
    setJobId(null);
  }, []);

  return {
    jobId,
    jobStatus: jobStatus ?? null,
    isActive,
    isCompleted,
    isFailed,
    startWatching,
    reset,
  };
}

/**
 * Hook to get the latest job for the current user
 */
export function useLatestQuizJob() {
  const latestJob = useQuery(api.customQuizWorkflow.getLatestJob);
  return latestJob;
}

