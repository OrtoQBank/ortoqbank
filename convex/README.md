# Welcome to your Convex functions directory!

Write your Convex functions here. See https://docs.convex.dev/functions for
more.

A query function that takes two arguments looks like:

```ts
// functions.js
import { query } from './_generated/server';
import { v } from 'convex/values';

export const myQueryFunction = query({
  // Validators for arguments.
  args: {
    first: v.number(),
    second: v.string(),
  },

  // Function implementation.
  handler: async (ctx, args) => {
    // Read the database as many times as you need here.
    // See https://docs.convex.dev/database/reading-data.
    const documents = await ctx.db.query('tablename').collect();

    // Arguments passed from the client are properties of the args object.
    console.log(args.first, args.second);

    // Write arbitrary JavaScript here: filter, aggregate, build derived data,
    // remove non-public properties, or create new objects.
    return documents;
  },
});
```

Using this query function in a React component looks like:

```ts
const data = useQuery(api.functions.myQueryFunction, {
  first: 10,
  second: 'hello',
});
```

A mutation function looks like:

```ts
// functions.js
import { mutation } from './_generated/server';
import { v } from 'convex/values';

export const myMutationFunction = mutation({
  // Validators for arguments.
  args: {
    first: v.string(),
    second: v.string(),
  },

  // Function implementation.
  handler: async (ctx, args) => {
    // Insert or modify documents in the database here.
    // Mutations can also read from the database like queries.
    // See https://docs.convex.dev/database/writing-data.
    const message = { body: args.first, author: args.second };
    const id = await ctx.db.insert('messages', message);

    // Optionally, return a value from your mutation.
    return await ctx.db.get(id);
  },
});
```

Using this mutation function in a React component looks like:

```ts
const mutation = useMutation(api.functions.myMutationFunction);
function handleButtonPress() {
  // fire and forget, the most common way to use mutations
  mutation({ first: 'Hello!', second: 'me' });
  // OR
  // use the result once the mutation has completed
  mutation({ first: 'Hello!', second: 'me' }).then(result =>
    console.log(result),
  );
}
```

Use the Convex CLI to push your functions to a deployment. See everything the
Convex CLI can do by running `npx convex -h` in your project root directory. To
learn more, launch the docs with `npx convex docs`.

Best Practices This is a list of best practices and common anti-patterns around
using Convex. We recommend going through this list before broadly releasing your
app to production. You may choose to try using all of these best practices from
the start, or you may wait until you've gotten major parts of your app working
before going through and adopting the best practices here.

Await all Promises Why? Convex functions use async / await. If you don't await
all your promises (e.g. await ctx.scheduler.runAfter, await ctx.db.patch), you
may run into unexpected behavior (e.g. failing to schedule a function) or miss
handling errors.

How? We recommend the no-floating-promises eslint rule with TypeScript.

Avoid .filter on database queries Why? Filtering in code instead of using the
.filter syntax has the same performance, and is generally easier code to write.
Conditions in .withIndex or .withSearchIndex are more efficient than .filter or
filtering in code, so almost all uses of .filter should either be replaced with
a .withIndex or .withSearchIndex condition, or written as TypeScript code.

Read through the indexes documentation for an overview of how to define indexes
and how they work.

Examples convex/messages.ts TS // ❌ const tomsMessages = ctx.db
.query("messages") .filter((q) => q.eq(q.field("author"), "Tom")) .collect();

// ✅ // Option 1: Use an index const tomsMessages = await ctx.db
.query("messages") .withIndex("by_author", (q) => q.eq("author", "Tom"))
.collect();

// Option 2: Filter in code const allMessages = await
ctx.db.query("messages").collect(); const tomsMessages = allMessages.filter((m)
=> m.author === "Tom");

How? Search for .filter in your Convex codebase — a regex like \.filter\(\(?q
will probably find all the ones on database queries.

Decide whether they should be replaced with a .withIndex condition — per this
section, if you are filtering over a large (1000+) or potentially unbounded
number of documents, you should use an index. If not using a .withIndex /
.withSearchIndex condition, consider replacing them with a filter in code for
more readability and flexibility.

See this article for more strategies for filtering.

Exceptions Using .filter on a paginated query (.paginate) has advantages over
filtering in code. The paginated query will return the number of documents
requested, including the .filter condition, so filtering in code afterwards can
result in a smaller page or even an empty page. Using .withIndex on a paginated
query will still be more efficient than a .filter.

Only use .collect with a small number of results Why? All results returned from
.collect count towards database bandwidth (even ones filtered out by .filter).
It also means that if any document in the result changes, the query will re-run
or the mutation will hit a conflict.

If there's a chance the number of results is large (say 1000+ documents), you
should use an index to filter the results further before calling .collect, or
find some other way to avoid loading all the documents such as using pagination,
denormalizing data, or changing the product feature.

Example Using an index:

convex/movies.ts TS // ❌ -- potentially unbounded const allMovies = await
ctx.db.query("movies").collect(); const moviesByDirector = allMovies.filter( (m)
=> m.director === "Steven Spielberg", );

// ✅ -- small number of results, so `collect` is fine const moviesByDirector =
await ctx.db .query("movies") .withIndex("by_director", (q) => q.eq("director",
"Steven Spielberg")) .collect();

Using pagination:

convex/movies.ts TS // ❌ -- potentially unbounded const watchedMovies = await
ctx.db .query("watchedMovies") .withIndex("by_user", (q) => q.eq("user", "Tom"))
.collect();

// ✅ -- using pagination, showing recently watched movies first const
watchedMovies = await ctx.db .query("watchedMovies") .withIndex("by_user", (q)
=> q.eq("user", "Tom")) .order("desc") .paginate(paginationOptions);

Using a limit or denormalizing:

convex/movies.ts TS // ❌ -- potentially unbounded const watchedMovies = await
ctx.db .query("watchedMovies") .withIndex("by_user", (q) => q.eq("user", "Tom"))
.collect(); const numberOfWatchedMovies = watchedMovies.length;

// ✅ -- Show "99+" instead of needing to load all documents const watchedMovies
= await ctx.db .query("watchedMovies") .withIndex("by_user", (q) => q.eq("user",
"Tom")) .take(100); const numberOfWatchedMovies = watchedMovies.length === 100 ?
"99+" : watchedMovies.length.toString();

// ✅ -- Denormalize the number of watched movies in a separate table const
watchedMoviesCount = await ctx.db .query("watchedMoviesCount")
.withIndex("by_user", (q) => q.eq("user", "Tom")) .unique();

How? Search for .collect in your Convex codebase (a regex like \.collect\( will
probably find these). And think through whether the number of results is small.
This function health page in the dashboard can also help surface these.

The aggregate component or database triggers can be helpful patterns for
denormalizing data.

Exceptions If you're doing something that requires loading a large number of
documents (e.g. performing a migration, making a summary), you may want to use
an action to load them in batches via separate queries / mutations.

Check for redundant indexes Why? Indexes like by_foo and by_foo_and_bar are
usually redundant (you only need by_foo_and_bar). Reducing the number of indexes
saves on database storage and reduces the overhead of writing to the table.

convex/teams.ts TS // ❌ const allTeamMembers = await ctx.db
.query("teamMembers") .withIndex("by*team", (q) => q.eq("team", teamId))
.collect(); const currentUserId = /* get current user id from `ctx.auth` \_/
const currentTeamMember = await ctx.db .query("teamMembers")
.withIndex("by_team_and_user", (q) => q.eq("team", teamId).eq("user",
currentUserId), ) .unique();

// ✅ // Just don't include a condition on `user` when querying for results on
`team` const allTeamMembers = await ctx.db .query("teamMembers")
.withIndex("by*team_and_user", (q) => q.eq("team", teamId)) .collect(); const
currentUserId = /* get current user id from `ctx.auth` \_/ const
currentTeamMember = await ctx.db .query("teamMembers")
.withIndex("by_team_and_user", (q) => q.eq("team", teamId).eq("user",
currentUserId), ) .unique();

How? Look through your indexes, either in your schema.ts file or in the
dashboard, and look for any indexes where one is a prefix of another.

Exceptions .index("by_foo", ["foo"]) is really an index on the properties foo
and \_creationTime, while .index("by_foo_and_bar", ["foo", "bar"]) is an index
on the properties foo, bar, and \_creationTime. If you have queries that need to
be sorted by foo and then \_creationTime, then you need both indexes.

For example, .index("by_channel", ["channel"]) on a table of messages can be
used to query for the most recent messages in a channel, but
.index("by_channel_and_author", ["channel", "author"]) could not be used for
this since it would first sort the messages by author.

Use argument validators for all public functions Why? Public functions can be
called by anyone, including potentially malicious attackers trying to break your
app. Argument validators (as well as return value validators) help ensure you're
getting the traffic you expect.

Example convex/messages.ts TS // ❌ -- could be used to update any document (not
just `messages`) export const updateMessage = mutation({ handler: async (ctx, {
id, update }) => { await ctx.db.patch(id, update); }, });

// ✅ -- can only be called with an ID from the messages table, and can only
update // the `body` and `author` fields export const updateMessage = mutation({
args: { id: v.id("messages"), update: v.object({ body: v.optional(v.string()),
author: v.optional(v.string()), }), }, handler: async (ctx, { id, update }) => {
await ctx.db.patch(id, update); }, });

How? Search for query, mutation, and action in your Convex codebase, and ensure
that all of them have argument validators (and optionally return value
validators). If you have httpActions, you may want to use something like zod to
validate that the HTTP request is the shape you expect.

Use some form of access control for all public functions Why? Public functions
can be called by anyone, including potentially malicious attackers trying to
break your app. If portions of your app should only be accessible when the user
is signed in, make sure all these Convex functions check that
ctx.auth.getUserIdentity() is set.

You may also have specific checks, like only loading messages that were sent to
or from the current user, which you'll want to apply in every relevant public
function.

Favoring more granular functions like setTeamOwner over updateTeam allows more
granular checks for which users can do what.

Access control checks should either use ctx.auth.getUserIdentity() or a function
argument that is unguessable (e.g. a UUID, or a Convex ID, provided that this ID
is never exposed to any client but the one user). In particular, don't use a
function argument which could be spoofed (e.g. email) for access control checks.

Example convex/teams.ts TS // ❌ -- no checks! anyone can update any team if
they get the ID export const updateTeam = mutation({ args: { id: v.id("teams"),
update: v.object({ name: v.optional(v.string()), owner:
v.optional(v.id("users")), }), }, handler: async (ctx, { id, update }) => {
await ctx.db.patch(id, update); }, });

// ❌ -- checks access, but uses `email` which could be spoofed export const
updateTeam = mutation({ args: { id: v.id("teams"), update: v.object({ name:
v.optional(v.string()), owner: v.optional(v.id("users")), }), email: v.string(),
}, handler: async (ctx, { id, update, email }) => { const teamMembers = /_ load
team members _/ if (!teamMembers.some((m) => m.email === email)) { throw new
Error("Unauthorized"); } await ctx.db.patch(id, update); }, });

// ✅ -- checks access, and uses `ctx.auth`, which cannot be spoofed export
const updateTeam = mutation({ args: { id: v.id("teams"), update: v.object({
name: v.optional(v.string()), owner: v.optional(v.id("users")), }), }, handler:
async (ctx, { id, update }) => { const user = await ctx.auth.getUserIdentity();
if (user === null) { throw new Error("Unauthorized"); } const isTeamMember = /_
check if user is a member of the team _/ if (!isTeamMember) { throw new
Error("Unauthorized"); } await ctx.db.patch(id, update); }, });

// ✅ -- separate functions which have different access control export const
setTeamOwner = mutation({ args: { id: v.id("teams"), owner: v.id("users"), },
handler: async (ctx, { id, owner }) => { const user = await
ctx.auth.getUserIdentity(); if (user === null) { throw new
Error("Unauthorized"); } const isTeamOwner = /_ check if user is the owner of
the team _/ if (!isTeamOwner) { throw new Error("Unauthorized"); } await
ctx.db.patch(id, { owner: owner }); }, });

export const setTeamName = mutation({ args: { id: v.id("teams"), name:
v.string(), }, handler: async (ctx, { id, name }) => { const user = await
ctx.auth.getUserIdentity(); if (user === null) { throw new
Error("Unauthorized"); } const isTeamMember = /_ check if user is a member of
the team _/ if (!isTeamMember) { throw new Error("Unauthorized"); } await
ctx.db.patch(id, { name: name }); }, });

How? Search for query, mutation, action, and httpAction in your Convex codebase,
and ensure that all of them have some form of access control. Custom functions
like authenticatedQuery can be helpful.

Some apps use Row Level Security (RLS) to check access to each document
automatically whenever it's loaded, as described in this article. Alternatively,
you can check access in each Convex function instead of checking access for each
document.

Helper functions for common checks and common operations can also be useful --
e.g. isTeamMember, isTeamAdmin, loadTeam (which throws if the current user does
not have access to the team).

Only schedule and ctx.run\* internal functions Why? Public functions can be
called by anyone, including potentially malicious attackers trying to break your
app, and should be carefully audited to ensure they can't be used maliciously.
Functions that are only called within Convex can be marked as internal, and
relax these checks since Convex will ensure that internal functions can only be
called within Convex.

How? Search for ctx.runQuery, ctx.runMutation, and ctx.runAction in your Convex
codebase. Also search for ctx.scheduler and check the crons.ts file. Ensure all
of these use internal.foo.bar functions instead of api.foo.bar functions.

If you have code you want to share between a public Convex function and an
internal Convex function, create a helper function that can be called from both.
The public function will likely have additional access control checks.

Alternatively, make sure that api from \_generated/api.ts is never used in your
Convex functions directory.

Examples convex/teams.ts TS // ❌ -- using `api` export const sendMessage =
mutation({ args: { body: v.string(), author: v.string(), }, handler: async (ctx,
{ body, author }) => { // add message to the database }, });

// crons.ts crons.daily( "send daily reminder", { hourUTC: 17, minuteUTC: 30 },
api.messages.sendMessage, { author: "System", body: "Share your daily update!"
}, );

// ✅ Using `internal` import { MutationCtx } from './\_generated/server'; async
function sendMessageHelper( ctx: MutationCtx, args: { body: string; author:
string }, ) { // add message to the database }

export const sendMessage = mutation({ args: { body: v.string(), }, handler:
async (ctx, { body }) => { const user = await ctx.auth.getUserIdentity(); if
(user === null) { throw new Error("Unauthorized"); } await
sendMessageHelper(ctx, { body, author: user.name ?? "Anonymous" }); }, });

export const sendInternalMessage = internalMutation({ args: { body: v.string(),
// don't need to worry about `author` being spoofed since this is an internal
function author: v.string(), }, handler: async (ctx, { body, author }) => {
await sendMessageHelper(ctx, { body, author }); }, });

// crons.ts crons.daily( "send daily reminder", { hourUTC: 17, minuteUTC: 30 },
internal.messages.sendInternalMessage, { author: "System", body: "Share your
daily update!" }, );

Use helper functions to write shared code Why? Most logic should be written as
plain TypeScript functions, with the query, mutation, and action wrapper
functions being a thin wrapper around one or more helper function.

Concretely, most of your code should live in a directory like convex/model, and
your public API, which is defined with query, mutation, and action, should have
very short functions that mostly just call into convex/model.

Organizing your code this way makes several of the refactors mentioned in this
list easier to do.

See the TypeScript page for useful types.

Example ❌ This example overuses ctx.runQuery and ctx.runMutation, which is
discussed more in the Avoid sequential ctx.runMutation / ctx.runQuery from
actions section.

convex/users.ts TS export const getCurrentUser = query({ args: {}, handler:
async (ctx) => { const userIdentity = await ctx.auth.getUserIdentity(); if
(userIdentity === null) { throw new Error("Unauthorized"); } const user = /_
query ctx.db to load the user _/ const userSettings = /_ load other documents
related to the user _/ return { user, settings: userSettings }; }, });

convex/conversations.ts TS export const listMessages = query({ args: {
conversationId: v.id("conversations"), }, handler: async (ctx, { conversationId
}) => { const user = await ctx.runQuery(api.users.getCurrentUser); const
conversation = await ctx.db.get(conversationId); if (conversation === null ||
!conversation.members.includes(user.\_id)) { throw new Error("Unauthorized"); }
const messages = /_ query ctx.db to load the messages _/ return messages; }, });

export const summarizeConversation = action({ args: { conversationId:
v.id("conversations"), }, handler: async (ctx, { conversationId }) => { const
messages = await ctx.runQuery(api.conversations.listMessages, { conversationId,
}); const summary = /_ call some external service to summarize the conversation
_/ await ctx.runMutation(api.conversations.addSummary, { conversationId,
summary, }); }, });

✅ Most of the code here is now in the convex/model directory. The API for this
application is in convex/conversations.ts, which contains very little code
itself.

convex/model/users.ts TS import { QueryCtx } from '../\_generated/server';

export async function getCurrentUser(ctx: QueryCtx) { const userIdentity = await
ctx.auth.getUserIdentity(); if (userIdentity === null) { throw new
Error("Unauthorized"); } const user = /_ query ctx.db to load the user _/ const
userSettings = /_ load other documents related to the user _/ return { user,
settings: userSettings }; }

convex/model/conversations.ts TS import { QueryCtx, MutationCtx } from
'../\_generated/server'; import \* as Users from './users';

export async function ensureHasAccess( ctx: QueryCtx, { conversationId }: {
conversationId: Id<"conversations"> }, ) { const user = await
Users.getCurrentUser(ctx); const conversation = await
ctx.db.get(conversationId); if (conversation === null ||
!conversation.members.includes(user.\_id)) { throw new Error("Unauthorized"); }
return conversation; }

export async function listMessages( ctx: QueryCtx, { conversationId }: {
conversationId: Id<"conversations"> }, ) { await ensureHasAccess(ctx, {
conversationId }); const messages = /_ query ctx.db to load the messages _/
return messages; }

export async function addSummary( ctx: MutationCtx, { conversationId, summary,
}: { conversationId: Id<"conversations">; summary: string }, ) { await
ensureHasAccess(ctx, { conversationId }); await ctx.db.patch(conversationId, {
summary }); }

export async function generateSummary( messages: Doc<"messages">[],
conversationId: Id<"conversations">, ) { const summary = /_ call some external
service to summarize the conversation _/ return summary; }

convex/conversations.ts TS import \* as Conversations from
'./model/conversations';

export const addSummary = internalMutation({ args: { conversationId:
v.id("conversations"), summary: v.string(), }, handler: async (ctx, {
conversationId, summary }) => { await Conversations.addSummary(ctx, {
conversationId, summary }); }, });

export const listMessages = internalQuery({ args: { conversationId:
v.id("conversations"), }, handler: async (ctx, { conversationId }) => { return
Conversations.listMessages(ctx, { conversationId }); }, });

export const summarizeConversation = action({ args: { conversationId:
v.id("conversations"), }, handler: async (ctx, { conversationId }) => { const
messages = await ctx.runQuery(internal.conversations.listMessages, {
conversationId, }); const summary = await Conversations.generateSummary(
messages, conversationId, ); await
ctx.runMutation(internal.conversations.addSummary, { conversationId, summary,
}); }, });

Use runAction only when using a different runtime Why? Calling runAction has
more overhead than calling a plain TypeScript function. It counts as an extra
function call with its own memory and CPU usage, while the parent action is
doing nothing except waiting for the result. Therefore, runAction should almost
always be replaced with calling a plain TypeScript function. However, if you
want to call code that requires Node.js from a function in the Convex runtime
(e.g. using a library that requires Node.js), then you can use runAction to call
the Node.js code.

Example convex/scrape.ts TS // ❌ -- using `runAction` export const
scrapeWebsite = action({ args: { siteMapUrl: v.string(), }, handler: async (ctx,
{ siteMapUrl }) => { const siteMap = await fetch(siteMapUrl); const pages = /_
parse the site map _/ await Promise.all( pages.map((page) =>
ctx.runAction(internal.scrape.scrapeSinglePage, { url: page }), ), ); }, });

convex/model/scrape.ts TS import { ActionCtx } from '../\_generated/server';

// ✅ -- using a plain TypeScript function export async function
scrapeSinglePage( ctx: ActionCtx, { url }: { url: string }, ) { const page =
await fetch(url); const text = /_ parse the page _/ await
ctx.runMutation(internal.scrape.addPage, { url, text }); }

convex/scrape.ts TS import \* as Scrape from './model/scrape';

export const scrapeWebsite = action({ args: { siteMapUrl: v.string(), },
handler: async (ctx, { siteMapUrl }) => { const siteMap = await
fetch(siteMapUrl); const pages = /_ parse the site map _/ await Promise.all(
pages.map((page) => Scrape.scrapeSinglePage(ctx, { url: page })), ); }, });

How? Search for runAction in your Convex codebase, and see if the function it
calls uses the same runtime as the parent function. If so, replace the runAction
with a plain TypeScript function. You may want to structure your functions so
the Node.js functions are in a separate directory so it's easier to spot these.

Avoid sequential ctx.runMutation / ctx.runQuery calls from actions Why? Each
ctx.runMutation or ctx.runQuery runs in its own transaction, which means if
they're called separately, they may not be consistent with each other. If
instead we call a single ctx.runQuery or ctx.runMutation, we're guaranteed that
the results we get are consistent.

How? Audit your calls to ctx.runQuery and ctx.runMutation in actions. If you see
multiple in a row with no other code between them, replace them with a single
ctx.runQuery or ctx.runMutation that handles both things. Refactoring your code
to use helper functions will make this easier.

Example: Queries convex/teams.ts TS // ❌ -- this assertion could fail if the
team changed between running the two queries const team = await
ctx.runQuery(internal.teams.getTeam, { teamId }); const teamOwner = await
ctx.runQuery(internal.teams.getTeamOwner, { teamId }); assert(team.owner ===
teamOwner.\_id);

convex/teams.ts TS import _ as Teams from './model/teams'; import _ as Users
from './model/users';

export const sendBillingReminder = action({ args: { teamId: v.id("teams"), },
handler: async (ctx, { teamId }) => { // ✅ -- this will always pass const
teamAndOwner = await ctx.runQuery(internal.teams.getTeamAndOwner, { teamId, });
assert(teamAndOwner.team.owner === teamAndOwner.owner.\_id); // send a billing
reminder email to the owner }, });

export const getTeamAndOwner = internalQuery({ args: { teamId: v.id("teams"), },
handler: async (ctx, { teamId }) => { const team = await Teams.load(ctx, {
teamId }); const owner = await Users.load(ctx, { userId: team.owner }); return {
team, owner }; }, });

Example: Loops convex/teams.ts TS import \* as Users from './model/users';

export const importTeams = action({ args: { teamId: v.id("teams"), }, handler:
async (ctx, { teamId }) => { // Fetch team members from an external API const
teamMembers = await fetchTeamMemberData(teamId);

    // ❌ This will run a separate mutation for inserting each user,
    // which means you lose transaction guarantees like atomicity.
    for (const member of teamMembers) {
      await ctx.runMutation(internal.teams.insertUser, member);
    }

}, }); export const insertUser = internalMutation({ args: { name: v.string(),
email: v.string() }, handler: async (ctx, { name, email }) => { await
Users.insert(ctx, { name, email }); }, });

convex/teams.ts TS import \* as Users from './model/users';

export const importTeams = action({ args: { teamId: v.id("teams"), }, handler:
async (ctx, { teamId }) => { // Fetch team members from an external API const
teamMembers = await fetchTeamMemberData(teamId);

    // ✅ This action runs a single mutation that inserts all users in the same transaction.
    await ctx.runMutation(internal.teams.insertUsers, teamMembers);

}, }); export const insertUsers = internalMutation({ args: { users:
v.array(v.object({ name: v.string(), email: v.string() })) }, handler: async
(ctx, { users }) => { for (const { name, email } of users) { await
Users.insert(ctx, { name, email }); } }, });

Exceptions If you're intentionally trying to process more data than fits in a
single transaction, like running a migration or aggregating data, then it makes
sense to have multiple sequential ctx.runMutation / ctx.runQuery calls.

Multiple ctx.runQuery / ctx.runMutation calls are often necessary because the
action does a side effect in between them. For example, reading some data,
feeding it to an external service, and then writing the result back to the
database.

Use ctx.runQuery and ctx.runMutation sparingly in queries and mutations Why?
While these queries and mutations run in the same transaction, and will give
consistent results, they have extra overhead compared to plain TypeScript
functions. Wanting a TypeScript helper function is much more common than needing
ctx.runQuery or ctx.runMutation.

How? Audit your calls to ctx.runQuery and ctx.runMutation in queries and
mutations. Unless one of the exceptions below applies, replace them with a plain
TypeScript function.

Exceptions If you're using components, these require ctx.runQuery or
ctx.runMutation. If you want partial rollback on an error, you will want
ctx.runMutation instead of a plain TypeScript function. convex/messages.ts TS
export const trySendMessage = mutation({ args: { body: v.string(), author:
v.string(), }, handler: async (ctx, { body, author }) => { try { await
ctx.runMutation(internal.messages.sendMessage, { body, author }); } catch (e) {
// Record the failure, but rollback any writes from `sendMessage` await
ctx.db.insert("failures", { kind: "MessageFailed", body, author, error:
`Error: ${e}`, }); } }, });

---

# Multi-Tenancy Architecture

This project implements multi-tenancy where multiple tenants (apps) share the same codebase and deployment.

## Core Concepts

### One Codebase, Many Tenants

- **Single deployment per environment** (dev, preview, production)
- **Tenants are data, not Git branches** - stored in the `apps` table
- **Same code serves all tenants** - tenant-specific behavior is driven by configuration

### Tenant Resolution

Tenants are resolved from the hostname using `resolveTenant()` in `src/lib/tenant.ts`:

| Environment | Hostname Format | Example |
|-------------|-----------------|---------|
| Local Development | `{tenant}.localhost:3000` | `app1.localhost:3000` |
| Vercel Preview | `{tenant}--{project}.vercel.app` | `app1--ortoqbank.vercel.app` |
| Production | `{tenant}.{domain}.com` | `teot.ortoqbank.com` |

### Architecture Flow

```
Hostname → resolveTenant() → slug → apps.getAppBySlug → tenantId → queries with tenantId
```

1. Middleware extracts tenant slug from hostname
2. Slug is stored in a cookie for client-side access
3. `TenantProvider` queries `apps` table to get `tenantId`
4. All data queries include `tenantId` for isolation

## Tenant Seeding

Tenants are seeded as data in the `apps` table, not created through Git branches.

### Adding a New Tenant

1. **Add to `apps` table** (via Convex dashboard or seed script):
   ```typescript
   await ctx.db.insert('apps', {
     slug: 'newtenant',
     name: 'New Tenant Display Name',
     domain: 'newtenant.ortoqbank.com',
     isActive: true,
     createdAt: Date.now(),
   });
   ```

2. **Add static configuration** in `src/config/tenants.config.ts`:
   ```typescript
   newtenant: {
     branding: { name: 'New Tenant', primaryColor: '#...' },
     content: { tagline: '...' },
   }
   ```

3. **For production**: Configure DNS to point `newtenant.domain.com` to Vercel

### Existing Tenants

Current tenants defined in the system:
- `ortoqbank` - Default tenant (OrtoQBank)
- `app1` - Test tenant for local development
- `teot` - OrtoQBank TEOT
- `derma` - DermaQBank
- `cardio` - CardioQBank

## Tenant Isolation

All content tables include `tenantId` for data isolation:

```typescript
// Schema example
themes: defineTable({
  tenantId: v.optional(v.id('apps')), // Required after migration
  name: v.string(),
}).index('by_tenant', ['tenantId'])
```

### Backend Enforcement

Every query/mutation that accesses tenant-specific data must:

1. Accept `tenantId` as an argument
2. Call `verifyTenantAccess(ctx, tenantId)` to verify access
3. Use tenant-scoped indexes (e.g., `by_tenant`, `by_tenant_and_theme`)

```typescript
export const list = query({
  args: { tenantId: v.optional(v.id('apps')) },
  handler: async (ctx, { tenantId }) => {
    await verifyTenantAccess(ctx, tenantId);
    
    return ctx.db
      .query('themes')
      .withIndex('by_tenant', q => q.eq('tenantId', tenantId))
      .collect();
  },
});
```

### Frontend Helpers

Use the tenant hooks from `src/hooks/useTenantQuery.ts`:

```typescript
// Automatically injects tenantId
const themes = useTenantQuery(api.themes.list, {});
const createTheme = useTenantMutation(api.themes.create);
```

## Production Deployment

Moving to production requires only DNS changes:

1. **Configure wildcard DNS**: `*.domain.com → Vercel`
2. **No code changes required** - the `resolveTenant()` function handles both formats
3. Preview uses `--` separator, production uses `.` separator
