import { v } from 'convex/values';

import { Doc, Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';

// Add a question to an event
export const addEventQuestion = mutation({
  args: {
    eventName: v.string(),
    title: v.string(),
    questionTextString: v.string(),
    explanationTextString: v.string(),
    alternatives: v.array(v.string()),
    correctAlternativeIndex: v.number(),
    questionCode: v.optional(v.string()),
    themeId: v.optional(v.id('themes')),
    difficulty: v.optional(
      v.union(v.literal('easy'), v.literal('medium'), v.literal('hard')),
    ),
    tags: v.optional(v.array(v.string())),
  },
  returns: v.id('eventQuestions'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('eventQuestions', {
      ...args,
      isActive: true,
    });
  },
});

// Copy questions from main app to event
export const copyQuestionsToEvent = mutation({
  args: {
    eventName: v.string(),
    questionIds: v.array(v.id('questions')),
  },
  returns: v.array(v.id('eventQuestions')),
  handler: async (ctx, args) => {
    const eventQuestionIds: Id<'eventQuestions'>[] = [];

    for (const questionId of args.questionIds) {
      const question = await ctx.db.get(questionId);
      if (!question) continue;

      const eventQuestionId = await ctx.db.insert('eventQuestions', {
        eventName: args.eventName,
        title: question.title,
        questionTextString: question.questionTextString,
        explanationTextString: question.explanationTextString,
        alternatives: question.alternatives,
        correctAlternativeIndex: question.correctAlternativeIndex,
        questionCode: question.questionCode,
        themeId: question.themeId,
        isActive: true,
      });

      eventQuestionIds.push(eventQuestionId);
    }

    return eventQuestionIds;
  },
});

// Copy ALL questions from main app to event (convenient for setup)
export const copyAllQuestionsToEvent = mutation({
  args: {
    eventName: v.string(),
    limit: v.optional(v.number()), // Optional limit for testing
    publicOnly: v.optional(v.boolean()), // Only copy public questions
  },
  returns: v.object({
    copiedCount: v.number(),
    questionIds: v.array(v.id('eventQuestions')),
  }),
  handler: async (ctx, args) => {
    // Get all questions from main database
    let allQuestions = await ctx.db.query('questions').collect();

    // Filter by public if requested
    if (args.publicOnly) {
      allQuestions = allQuestions.filter(q => q.isPublic === true);
    }

    // Apply limit if specified
    if (args.limit) {
      allQuestions = allQuestions.slice(0, args.limit);
    }

    const eventQuestionIds: Id<'eventQuestions'>[] = [];

    for (const question of allQuestions) {
      try {
        const eventQuestionId = await ctx.db.insert('eventQuestions', {
          eventName: args.eventName,
          title: question.title,
          questionTextString: question.questionTextString,
          explanationTextString: question.explanationTextString,
          alternatives: question.alternatives,
          correctAlternativeIndex: question.correctAlternativeIndex,
          questionCode: question.questionCode,
          themeId: question.themeId,
          difficulty: undefined, // We can add this later if needed
          tags: ['real-question', 'from-main-db'],
          isActive: true,
        });

        eventQuestionIds.push(eventQuestionId);
      } catch (error) {
        console.error(`Failed to copy question ${question._id}:`, error);
        // Continue with other questions
      }
    }

    return {
      copiedCount: eventQuestionIds.length,
      questionIds: eventQuestionIds,
    };
  },
});

// Copy questions from specific themes to event
export const copyQuestionsByThemeToEvent = mutation({
  args: {
    eventName: v.string(),
    themeIds: v.array(v.id('themes')),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    copiedCount: v.number(),
    questionIds: v.array(v.id('eventQuestions')),
  }),
  handler: async (ctx, args) => {
    const eventQuestionIds: Id<'eventQuestions'>[] = [];

    for (const themeId of args.themeIds) {
      const themeQuestions = await ctx.db
        .query('questions')
        .withIndex('by_theme', q => q.eq('themeId', themeId))
        .collect();

      // Apply limit per theme if specified
      const questionsToAdd = args.limit
        ? themeQuestions.slice(0, args.limit)
        : themeQuestions;

      for (const question of questionsToAdd) {
        try {
          const eventQuestionId = await ctx.db.insert('eventQuestions', {
            eventName: args.eventName,
            title: question.title,
            questionTextString: question.questionTextString,
            explanationTextString: question.explanationTextString,
            alternatives: question.alternatives,
            correctAlternativeIndex: question.correctAlternativeIndex,
            questionCode: question.questionCode,
            themeId: question.themeId,
            difficulty: undefined,
            tags: ['real-question', 'by-theme'],
            isActive: true,
          });

          eventQuestionIds.push(eventQuestionId);
        } catch (error) {
          console.error(`Failed to copy question ${question._id}:`, error);
        }
      }
    }

    return {
      copiedCount: eventQuestionIds.length,
      questionIds: eventQuestionIds,
    };
  },
});

// Get event questions count
export const getEventQuestionsCount = query({
  args: {
    eventName: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const questions = await ctx.db
      .query('eventQuestions')
      .withIndex('by_event_active', q =>
        q.eq('eventName', args.eventName).eq('isActive', true),
      )
      .collect();

    return questions.length;
  },
});

// List event questions (for admin)
export const listEventQuestions = query({
  args: {
    eventName: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id('eventQuestions'),
      title: v.string(),
      questionCode: v.optional(v.string()),
      difficulty: v.optional(
        v.union(v.literal('easy'), v.literal('medium'), v.literal('hard')),
      ),
      isActive: v.optional(v.boolean()),
    }),
  ),
  handler: async (ctx, args) => {
    const questions = await ctx.db
      .query('eventQuestions')
      .withIndex('by_event', q => q.eq('eventName', args.eventName))
      .take(args.limit || 100);

    return questions.map(q => ({
      _id: q._id,
      title: q.title,
      questionCode: q.questionCode,
      difficulty: q.difficulty,
      isActive: q.isActive,
    }));
  },
});

// Helper function to populate event with sample questions (for testing/setup)
export const populateEventWithSampleQuestions = mutation({
  args: {
    eventName: v.string(),
    count: v.optional(v.number()),
  },
  returns: v.array(v.id('eventQuestions')),
  handler: async (ctx, args) => {
    const questionCount = args.count || 50;
    const eventQuestionIds: Id<'eventQuestions'>[] = [];

    for (let i = 1; i <= questionCount; i++) {
      // Create proper JSON content structure
      const questionContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: `Esta é a questão número ${i} do evento ${args.eventName}. Escolha a alternativa correta.`,
              },
            ],
          },
        ],
      };

      const explanationContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: `A resposta correta é a alternativa A, porque esta é uma questão de exemplo número ${i}.`,
              },
            ],
          },
        ],
      };

      const eventQuestionId = await ctx.db.insert('eventQuestions', {
        eventName: args.eventName,
        title: `Questão ${i} - ${args.eventName}`,
        questionTextString: JSON.stringify(questionContent),
        explanationTextString: JSON.stringify(explanationContent),
        alternatives: [
          'Alternativa A (Correta)',
          'Alternativa B',
          'Alternativa C',
          'Alternativa D',
        ],
        correctAlternativeIndex: 0,
        questionCode: `Q${i.toString().padStart(3, '0')}`,
        difficulty: i <= 15 ? 'easy' : i <= 35 ? 'medium' : 'hard',
        tags: ['evento', 'sample'],
        isActive: true,
      });

      eventQuestionIds.push(eventQuestionId);
    }

    return eventQuestionIds;
  },
});

// Clean up questions from an event (useful for cleanup/reset)
export const deleteEventQuestions = mutation({
  args: {
    eventName: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const questions = await ctx.db
      .query('eventQuestions')
      .withIndex('by_event', q => q.eq('eventName', args.eventName))
      .collect();

    for (const question of questions) {
      await ctx.db.delete(question._id);
    }

    return questions.length;
  },
});

// Clean up user session (reset user to allow restart)
export const resetEventUser = mutation({
  args: {
    eventUserId: v.id('eventUsers'),
  },
  returns: v.object({
    deletedSessions: v.number(),
    userReset: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Delete any existing sessions for this user
    const sessions = await ctx.db
      .query('eventQuizSessions')
      .withIndex('by_event_user', q => q.eq('eventUserId', args.eventUserId))
      .collect();

    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    // Reset user flags
    await ctx.db.patch(args.eventUserId, {
      hasStartedExam: false,
      examStartedAt: undefined,
      hasCompletedExam: false,
      examCompletedAt: undefined,
    });

    return {
      deletedSessions: sessions.length,
      userReset: true,
    };
  },
});

// Register a new event user
export const registerEventUser = mutation({
  args: {
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    phone: v.optional(v.string()),
    university: v.optional(v.string()),
    graduationYear: v.optional(v.number()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    socialMedia: v.optional(
      v.object({
        instagram: v.optional(v.string()),
        linkedin: v.optional(v.string()),
        whatsapp: v.optional(v.string()),
      }),
    ),
    eventName: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user already registered for this event
    const existingUser = await ctx.db
      .query('eventUsers')
      .withIndex('by_email_event', q =>
        q.eq('email', args.email.toLowerCase()).eq('eventName', args.eventName),
      )
      .unique();

    if (existingUser) {
      throw new Error('Email already registered for this event');
    }

    // Create new event user
    const eventUserId = await ctx.db.insert('eventUsers', {
      ...args,
      email: args.email.toLowerCase(),
      registeredAt: Date.now(),
    });

    return eventUserId;
  },
});

// Get event user by email and event
export const getEventUser = query({
  args: {
    email: v.string(),
    eventName: v.string(),
  },
  handler: async (ctx, args) => {
    const eventUser = await ctx.db
      .query('eventUsers')
      .withIndex('by_email_event', q =>
        q.eq('email', args.email.toLowerCase()).eq('eventName', args.eventName),
      )
      .unique();

    return eventUser;
  },
});

// Start an event quiz session
export const startEventQuiz = mutation({
  args: {
    eventUserId: v.id('eventUsers'),
    eventName: v.string(),
    questionCount: v.optional(v.number()), // Default to 50 questions
  },
  handler: async (ctx, args) => {
    const eventUser = await ctx.db.get(args.eventUserId);
    if (!eventUser) {
      throw new Error('Event user not found');
    }

    // Check if user already has an active session
    const existingSession = await ctx.db
      .query('eventQuizSessions')
      .withIndex('by_event_user', q =>
        q.eq('eventUserId', args.eventUserId).eq('eventName', args.eventName),
      )
      .unique();

    if (existingSession) {
      if (!existingSession.isComplete && !existingSession.isExpired) {
        // Return existing active session
        return existingSession._id;
      }
      // If session is complete or expired, don't allow restart
      throw new Error(
        'You have already completed this exam or your time has expired',
      );
    }

    // Select questions from the event-specific questions
    const questionCount = args.questionCount || 50;

    // Get all active event questions
    const eventQuestions = await ctx.db
      .query('eventQuestions')
      .withIndex('by_event_active', q =>
        q.eq('eventName', args.eventName).eq('isActive', true),
      )
      .collect();

    if (eventQuestions.length < questionCount) {
      throw new Error(
        `Not enough questions available for the exam. Found ${eventQuestions.length}, need ${questionCount}. Please add more questions to the event.`,
      );
    }

    // Randomly select questions
    const shuffled = eventQuestions.sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffled.slice(0, questionCount);
    const questionIds = selectedQuestions.map(q => q._id);

    // Create quiz session
    const startTime = Date.now();
    const expiresAt = startTime + 4 * 60 * 60 * 1000; // 4 hours from now

    const sessionId = await ctx.db.insert('eventQuizSessions', {
      eventUserId: args.eventUserId,
      eventName: args.eventName,
      questions: questionIds,
      currentQuestionIndex: 0,
      answers: [],
      answerFeedback: [],
      startedAt: startTime,
      expiresAt,
      isComplete: false,
    });

    // Update event user to mark exam as started
    await ctx.db.patch(args.eventUserId, {
      hasStartedExam: true,
      examStartedAt: startTime,
    });

    return sessionId;
  },
});

// Get event quiz session
export const getEventQuizSession = query({
  args: {
    eventUserId: v.id('eventUsers'),
    eventName: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('eventQuizSessions')
      .withIndex('by_event_user', q =>
        q.eq('eventUserId', args.eventUserId).eq('eventName', args.eventName),
      )
      .unique();

    if (!session) {
      return null;
    }

    // Check if session has expired
    const now = Date.now();
    if (now > session.expiresAt && !session.isComplete) {
      // Return session with expired flag (don't mutate in a query)
      return { ...session, isExpired: true };
    }

    return session;
  },
});

// Mark session as expired (called from client when needed)
export const markSessionExpired = mutation({
  args: {
    sessionId: v.id('eventQuizSessions'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Only mark as expired if not already complete
    if (!session.isComplete) {
      await ctx.db.patch(args.sessionId, { isExpired: true });
    }

    return session;
  },
});

// Get questions for event quiz session
export const getEventQuizQuestions = query({
  args: {
    sessionId: v.id('eventQuizSessions'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Get questions but only return safe data (no correct answers)
    const questions = await Promise.all(
      session.questions.map(async questionId => {
        const question = await ctx.db.get(questionId);
        if (!question) throw new Error('Event question not found');

        return {
          _id: question._id,
          _creationTime: question._creationTime,
          title: question.title,
          questionTextString: question.questionTextString,
          alternatives: question.alternatives,
          questionCode: question.questionCode,
        };
      }),
    );

    return {
      ...session,
      questions,
    };
  },
});

// Submit answer for event quiz
export const submitEventQuizAnswer = mutation({
  args: {
    sessionId: v.id('eventQuizSessions'),
    questionIndex: v.number(),
    selectedAlternative: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Check if session has expired
    const now = Date.now();
    if (now > session.expiresAt) {
      await ctx.db.patch(session._id, { isExpired: true });
      throw new Error('Session has expired');
    }

    if (session.isComplete) {
      throw new Error('Session is already complete');
    }

    // Get the question to check answer
    const questionId = session.questions[args.questionIndex];
    const question = await ctx.db.get(questionId);
    if (!question) {
      throw new Error('Question not found');
    }

    // Check if answer is correct
    const isCorrect =
      question.correctAlternativeIndex === args.selectedAlternative;

    // Create feedback (but don't reveal correct answer until completion)
    const feedback = {
      isCorrect,
      explanation: question.explanationTextString,
      correctAlternative: question.correctAlternativeIndex,
    };

    // Update session with answer
    const updatedAnswers = [...session.answers];
    const updatedFeedback = [...session.answerFeedback];

    updatedAnswers[args.questionIndex] = args.selectedAlternative;
    updatedFeedback[args.questionIndex] = feedback;

    const updates: Partial<Doc<'eventQuizSessions'>> = {
      answers: updatedAnswers,
      answerFeedback: updatedFeedback,
      currentQuestionIndex: Math.min(
        args.questionIndex + 1,
        session.questions.length - 1,
      ),
    };

    await ctx.db.patch(session._id, updates);

    return { success: true };
  },
});

// Complete event quiz
export const completeEventQuiz = mutation({
  args: {
    sessionId: v.id('eventQuizSessions'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.isComplete) {
      throw new Error('Session is already complete');
    }

    // Calculate score
    const score = session.answerFeedback.filter(
      feedback => feedback.isCorrect,
    ).length;
    const totalQuestions = session.questions.length;
    const percentage = (score / totalQuestions) * 100;
    const timeSpentMinutes = Math.round(
      (Date.now() - session.startedAt) / (1000 * 60),
    );

    // Mark session as complete
    await ctx.db.patch(session._id, {
      isComplete: true,
    });

    // Update event user
    await ctx.db.patch(session.eventUserId, {
      hasCompletedExam: true,
      examCompletedAt: Date.now(),
    });

    // Create score record
    const scoreId = await ctx.db.insert('eventScores', {
      eventUserId: session.eventUserId,
      eventName: session.eventName,
      score,
      totalQuestions,
      percentage,
      timeSpentMinutes,
      answers: session.answers,
      questionIds: session.questions,
      completedAt: Date.now(),
    });

    return {
      scoreId,
      score,
      totalQuestions,
      percentage,
      timeSpentMinutes,
    };
  },
});

// Get event leaderboard
export const getEventLeaderboard = query({
  args: {
    eventName: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;

    // Get top scores, ordered by percentage (desc) then by time (asc)
    const scores = await ctx.db
      .query('eventScores')
      .withIndex('by_event_leaderboard', q => q.eq('eventName', args.eventName))
      .order('desc') // percentage descending
      .take(limit * 2); // Take more to sort by time

    // Sort by percentage (desc) and then by time (asc) for ties
    const sortedScores = scores
      .sort((a, b) => {
        if (a.percentage !== b.percentage) {
          return b.percentage - a.percentage; // Higher percentage first
        }
        return a.timeSpentMinutes - b.timeSpentMinutes; // Lower time first
      })
      .slice(0, limit);

    // Get user info for each score
    const leaderboard = await Promise.all(
      sortedScores.map(async (score, index) => {
        const eventUser = await ctx.db.get(score.eventUserId);
        return {
          rank: index + 1,
          name: `${eventUser?.firstName} ${eventUser?.lastName}`,
          email: eventUser?.email,
          university: eventUser?.university,
          score: score.score,
          totalQuestions: score.totalQuestions,
          percentage: score.percentage,
          timeSpentMinutes: score.timeSpentMinutes,
          completedAt: score.completedAt,
          isWinner: score.isWinner,
        };
      }),
    );

    return leaderboard;
  },
});

// Get event user's score
export const getEventUserScore = query({
  args: {
    eventUserId: v.id('eventUsers'),
    eventName: v.string(),
  },
  handler: async (ctx, args) => {
    const score = await ctx.db
      .query('eventScores')
      .withIndex('by_event_user', q =>
        q.eq('eventUserId', args.eventUserId).eq('eventName', args.eventName),
      )
      .unique();

    return score;
  },
});

// Get event statistics
export const getEventStats = query({
  args: {
    eventName: v.string(),
  },
  handler: async (ctx, args) => {
    const allUsers = await ctx.db
      .query('eventUsers')
      .withIndex('by_event', q => q.eq('eventName', args.eventName))
      .collect();

    const completedUsers = allUsers.filter(user => user.hasCompletedExam);
    const startedUsers = allUsers.filter(user => user.hasStartedExam);

    const scores = await ctx.db
      .query('eventScores')
      .withIndex('by_event_score', q => q.eq('eventName', args.eventName))
      .collect();

    const averageScore =
      scores.length > 0
        ? scores.reduce((sum, score) => sum + score.percentage, 0) /
          scores.length
        : 0;

    const averageTime =
      scores.length > 0
        ? scores.reduce((sum, score) => sum + score.timeSpentMinutes, 0) /
          scores.length
        : 0;

    return {
      totalRegistered: allUsers.length,
      totalStarted: startedUsers.length,
      totalCompleted: completedUsers.length,
      averageScore: Math.round(averageScore * 100) / 100,
      averageTimeMinutes: Math.round(averageTime),
      completionRate:
        allUsers.length > 0
          ? (completedUsers.length / allUsers.length) * 100
          : 0,
    };
  },
});
