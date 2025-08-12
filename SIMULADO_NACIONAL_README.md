# Simulado Nacional 2025 - Event System

This is a special weekend event system built for OrtqBank that allows users to
participate in a timed exam without requiring authentication into the main app.

## Features

### User Experience

- **Open Registration**: Users can register with email and social info without
  creating an account
- **4-Hour Timed Exam**: Participants have exactly 4 hours to complete 50
  randomly selected questions
- **Real-time Timer**: Countdown timer with visual warnings when time is running
  low
- **Progress Tracking**: Users can see their progress and navigate between
  questions
- **No Pausing**: Once started, the exam must be completed within the time limit
- **Results & Leaderboard**: Real-time leaderboard showing rankings by score and
  time

### Admin Features

- **Event Statistics**: View total participants, completion rates, and averages
- **Winner Selection**: Automatic winner determination based on highest score
  and fastest time
- **Data Isolation**: Event data is completely separate from main app users

## URL Structure

- `/simulado-nacional-2025` - Registration and event landing page
- `/simulado-nacional-2025/quiz` - The timed exam interface
- `/simulado-nacional-2025/results` - Results and leaderboard page

## Database Tables

### `eventUsers`

Stores participant registration data including:

- Personal info (name, email, phone)
- Academic info (university, graduation year)
- Location (city, state)
- Social media handles
- Exam status tracking

### `eventScores`

Stores final exam results including:

- Score and percentage
- Time spent
- User's answers
- Question IDs used
- Winner flag

### `eventQuizSessions`

Manages active exam sessions including:

- Selected questions for each participant
- Current progress
- Answer tracking
- Expiration time (4 hours from start)

## Key Features

### Authentication Bypass

The `/simulado-nacional-2025` route is excluded from Clerk authentication in
`middleware.ts`, allowing public access.

### Question Selection

Each participant gets 50 randomly selected questions from the main question
bank, ensuring variety while maintaining fairness.

### Timer Implementation

- 4-hour countdown timer with real-time updates
- Visual warnings at 30 minutes and 10 minutes remaining
- Automatic submission when time expires
- Session expiration handling

### Scoring System

- Rankings based on percentage score (primary)
- Time taken as tiebreaker (faster wins)
- Real-time leaderboard updates
- Winner identification and marking

## Admin Operations

### Determine Winner

```javascript
// In Convex dashboard or admin interface
await ctx.runAction('eventAdmin:determineEventWinner', {
  eventName: 'simulado-nacional-2025',
});
```

### Get Event Summary

```javascript
// Get event statistics and top participants
await ctx.runAction('eventAdmin:getEventSummary', {
  eventName: 'simulado-nacional-2025',
});
```

## Event Configuration

The event is configured with these parameters:

- **Event Name**: "simulado-nacional-2025" (used as identifier)
- **Question Count**: 50 questions per participant
- **Time Limit**: 4 hours (240 minutes)
- **Prize**: 1 year free access to the app

## Technical Notes

### Session Management

- Each user gets one exam session per event
- Sessions track expiration time and prevent restart after completion
- Answers are saved in real-time to prevent data loss

### Question Randomization

- Questions are randomly selected when the exam starts
- Each participant may get different questions
- Question order is maintained throughout the session

### Performance Considerations

- Leaderboard queries are optimized with proper indexing
- Real-time updates use Convex's reactive system
- Minimal data transfer for question content (no correct answers until
  completion)

## Future Events

To create a new event:

1. Change the `EVENT_NAME` constant in the components
2. Update the route structure (e.g., `/simulado-nacional-2026`)
3. The database tables will automatically handle multiple events
4. Update middleware to include the new route

## Security

- No authentication required for participation
- Correct answers are not revealed until exam completion
- Session expiration prevents extended exam time
- Email validation prevents duplicate registrations per event
