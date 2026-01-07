import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // =============================================================================
  // MULTI-TENANCY TABLES
  // =============================================================================

  // Apps table - defines each tenant/app in the ecosystem
  apps: defineTable({
    slug: v.string(), // "teot", "derma" - used in subdomain
    name: v.string(), // "OrtoQBank TEOT"
    domain: v.string(), // "teot.ortoqbank.com"
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index('by_slug', ['slug'])
    .index('by_domain', ['domain'])
    .index('by_active', ['isActive']),

  // User-App Access - tracks which users have access to which apps
  userAppAccess: defineTable({
    userId: v.id('users'),
    appId: v.id('apps'),
    hasAccess: v.boolean(),
    // Per-app role: 'user' for regular users, 'moderator' for app-specific admins
    role: v.optional(v.union(v.literal('user'), v.literal('moderator'))),
    grantedAt: v.number(),
    expiresAt: v.optional(v.number()),
    grantedBy: v.optional(v.id('users')), // Admin who granted access
  })
    .index('by_user', ['userId'])
    .index('by_user_app', ['userId', 'appId'])
    .index('by_app', ['appId'])
    .index('by_app_role', ['appId', 'role']),

  // =============================================================================
  // GLOBAL TABLES (No tenantId - shared across all apps)
  // =============================================================================

  // Users table
  users: defineTable({
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.string(),
    imageUrl: v.optional(v.string()),
    clerkUserId: v.string(),
    // Legacy payment fields (for backward compatibility with MercadoPago)
    paid: v.optional(v.boolean()),
    paymentId: v.optional(v.union(v.string(), v.number())),
    testeId: v.optional(v.string()),
    paymentDate: v.optional(v.string()),
    paymentStatus: v.optional(v.string()),
    // User management
    termsAccepted: v.optional(v.boolean()),
    onboardingCompleted: v.optional(v.boolean()),
    role: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal('invited'),
        v.literal('active'),
        v.literal('suspended'),
        v.literal('expired'),
      ),
    ),
    // Year-based access control
    hasActiveYearAccess: v.optional(v.boolean()),
  })
    .index('by_clerkUserId', ['clerkUserId'])
    .index('by_paid', ['paid'])
    .index('by_email', ['email'])
    .index('by_status', ['status']),

  // =============================================================================
  // CONTENT TABLES (With tenantId for multi-tenancy)
  // =============================================================================

  themes: defineTable({
    // Multi-tenancy
    tenantId: v.optional(v.id('apps')), // Optional during migration, required after
    name: v.string(),
    prefix: v.optional(v.string()),
    displayOrder: v.optional(v.number()),
  })
    .index('by_name', ['name'])
    .index('by_tenant', ['tenantId'])
    .index('by_tenant_and_name', ['tenantId', 'name']),

  subthemes: defineTable({
    // Multi-tenancy
    tenantId: v.optional(v.id('apps')),
    name: v.string(),
    themeId: v.id('themes'),
    prefix: v.optional(v.string()),
  })
    .index('by_theme', ['themeId'])
    .index('by_tenant', ['tenantId'])
    .index('by_tenant_and_theme', ['tenantId', 'themeId']),

  groups: defineTable({
    // Multi-tenancy
    tenantId: v.optional(v.id('apps')),
    name: v.string(),
    subthemeId: v.id('subthemes'),
    prefix: v.optional(v.string()),
  })
    .index('by_subtheme', ['subthemeId'])
    .index('by_tenant', ['tenantId'])
    .index('by_tenant_and_subtheme', ['tenantId', 'subthemeId']),

  // Tags table
  tags: defineTable({ name: v.string() }),

  // Question Content - Heavy content stored separately for performance
  // Load this only when viewing/editing a question, not for lists
  questionContent: defineTable({
    questionId: v.id('questions'),
    questionTextString: v.string(), // Rich text JSON (heavy)
    explanationTextString: v.string(), // Rich text JSON (heavy)
    alternatives: v.array(v.string()), // Answer options
    // Legacy fields (for migration - will be removed after migration complete)
    questionText: v.optional(v.any()),
    explanationText: v.optional(v.any()),
  }).index('by_question', ['questionId']),

  // Questions - Light metadata for lists, filtering, aggregates
  questions: defineTable({
    // Multi-tenancy
    tenantId: v.optional(v.id('apps')), // Optional during migration, required after

    // Metadata (light)
    title: v.string(),
    normalizedTitle: v.string(),
    questionCode: v.optional(v.string()),
    orderedNumberId: v.optional(v.number()),

    // Taxonomy IDs (for filtering/aggregates)
    themeId: v.id('themes'),
    subthemeId: v.optional(v.id('subthemes')),
    groupId: v.optional(v.id('groups')),

    // DENORMALIZED: Taxonomy names (for display - no extra fetches needed)
    themeName: v.optional(v.string()),
    subthemeName: v.optional(v.string()),
    groupName: v.optional(v.string()),

    // Quiz essentials (keep in main table for quiz generation)
    correctAlternativeIndex: v.number(),
    alternativeCount: v.optional(v.number()), // Just the count, not full content

    // Other metadata
    authorId: v.optional(v.id('users')),
    isPublic: v.optional(v.boolean()),

    // Migration tracking
    contentMigrated: v.optional(v.boolean()), // True when content moved to questionContent table

    // ==========================================================================
    // DEPRECATED FIELDS - TO BE REMOVED AFTER MIGRATION
    // ==========================================================================
    // These fields are being migrated to the questionContent table.
    //
    // MIGRATION STATUS:
    // 1. ✅ All READ operations now use questionContent table
    // 2. ✅ All WRITE operations now write to questionContent table only
    // 3. ⏳ Run removeHeavyContentFromQuestions migration to clear this data
    // 4. ⏳ After migration completes, remove these field definitions
    //
    // TO COMPLETE MIGRATION:
    // 1. Run: npx convex run migrations:runRemoveHeavyContentMigration
    // 2. Verify all questions work correctly
    // 3. Remove the deprecated field definitions below
    // ==========================================================================
    questionText: v.optional(v.any()), // DEPRECATED: Use questionContent.questionTextString
    explanationText: v.optional(v.any()), // DEPRECATED: Use questionContent.explanationTextString
    questionTextString: v.optional(v.string()), // DEPRECATED: Use questionContent.questionTextString
    explanationTextString: v.optional(v.string()), // DEPRECATED: Use questionContent.explanationTextString
    alternatives: v.optional(v.array(v.string())), // DEPRECATED: Use questionContent.alternatives

    // Legacy taxonomy fields (for migration cleanup only)
    TaxThemeId: v.optional(v.string()),
    TaxSubthemeId: v.optional(v.string()),
    TaxGroupId: v.optional(v.string()),
    taxonomyPathIds: v.optional(v.array(v.string())),
  })
    .index('by_title', ['normalizedTitle'])
    .index('by_theme', ['themeId'])
    .index('by_subtheme', ['subthemeId'])
    .index('by_group', ['groupId'])
    // Tenant-first indexes for multi-tenancy
    .index('by_tenant', ['tenantId'])
    .index('by_tenant_and_theme', ['tenantId', 'themeId'])
    .index('by_tenant_and_subtheme', ['tenantId', 'subthemeId'])
    .index('by_tenant_and_group', ['tenantId', 'groupId'])
    .searchIndex('search_by_title', { searchField: 'title' })
    .searchIndex('search_by_code', { searchField: 'questionCode' }),

  presetQuizzes: defineTable({
    // Multi-tenancy
    tenantId: v.optional(v.id('apps')),
    name: v.string(),
    description: v.string(),
    category: v.union(v.literal('trilha'), v.literal('simulado')),
    questions: v.array(v.id('questions')),
    subcategory: v.optional(v.string()),
    // Current taxonomy fields
    themeId: v.optional(v.id('themes')),
    subthemeId: v.optional(v.id('subthemes')),
    groupId: v.optional(v.id('groups')),
    isPublic: v.boolean(),
    displayOrder: v.optional(v.number()),
    // Legacy taxonomy fields (for migration cleanup only)
    TaxThemeId: v.optional(v.string()),
    TaxSubthemeId: v.optional(v.string()),
    TaxGroupId: v.optional(v.string()),
    taxonomyPathIds: v.optional(v.array(v.string())),
  })
    .index('by_theme', ['themeId'])
    .index('by_subtheme', ['subthemeId'])
    .index('by_group', ['groupId'])
    .index('by_category', ['category'])
    .index('by_tenant', ['tenantId'])
    .index('by_tenant_and_category', ['tenantId', 'category'])
    .index('by_tenant_and_theme', ['tenantId', 'themeId'])
    .searchIndex('search_by_name', { searchField: 'name' }),

  customQuizzes: defineTable({
    // Multi-tenancy
    tenantId: v.optional(v.id('apps')),
    name: v.string(),
    description: v.string(),
    questions: v.array(v.id('questions')),
    authorId: v.id('users'),
    testMode: v.union(v.literal('exam'), v.literal('study')),
    questionMode: v.union(
      v.literal('all'),
      v.literal('unanswered'),
      v.literal('incorrect'),
      v.literal('bookmarked'),
    ),
    // Current taxonomy fields
    selectedThemes: v.optional(v.array(v.id('themes'))),
    selectedSubthemes: v.optional(v.array(v.id('subthemes'))),
    selectedGroups: v.optional(v.array(v.id('groups'))),
    // Legacy taxonomy fields (for migration cleanup only)
    selectedTaxThemes: v.optional(v.array(v.string())),
    selectedTaxSubthemes: v.optional(v.array(v.string())),
    selectedTaxGroups: v.optional(v.array(v.string())),
    taxonomyPathIds: v.optional(v.array(v.string())),
  })
    .index('by_tenant', ['tenantId'])
    .index('by_tenant_and_author', ['tenantId', 'authorId'])
    .searchIndex('search_by_name', { searchField: 'name' }),

  quizSessions: defineTable({
    // Multi-tenancy
    tenantId: v.optional(v.id('apps')),
    userId: v.id('users'),
    quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')),
    mode: v.union(v.literal('exam'), v.literal('study')),
    currentQuestionIndex: v.number(),
    answers: v.array(v.number()),
    answerFeedback: v.array(
      v.object({
        isCorrect: v.boolean(),
        // Update explanation field to prefer string format
        explanation: v.union(
          v.string(), // String format (preferred)
          v.object({ type: v.string(), content: v.array(v.any()) }), // Legacy object format
        ),
        correctAlternative: v.optional(v.number()),
      }),
    ),
    isComplete: v.boolean(),
  })
    .index('by_user_quiz', ['userId', 'quizId', 'isComplete'])
    .index('by_tenant', ['tenantId'])
    .index('by_tenant_and_user', ['tenantId', 'userId']),

  // Lightweight table for tracking completed quiz sessions (denormalized for performance)
  // This avoids reading heavy answerFeedback data when just checking completion status
  completedQuizSummaries: defineTable({
    tenantId: v.optional(v.id('apps')),
    userId: v.id('users'),
    quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')),
    sessionId: v.id('quizSessions'),
    completedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_session', ['sessionId'])
    .index('by_tenant_and_user', ['tenantId', 'userId']),

  // Lightweight table for tracking active (incomplete) quiz sessions
  // This avoids reading heavy answerFeedback data when just checking active status
  activeQuizSessions: defineTable({
    tenantId: v.optional(v.id('apps')),
    userId: v.id('users'),
    quizId: v.union(v.id('presetQuizzes'), v.id('customQuizzes')),
    sessionId: v.id('quizSessions'),
    startedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_session', ['sessionId'])
    .index('by_tenant_and_user', ['tenantId', 'userId']),

  userBookmarks: defineTable({
    // Multi-tenancy
    tenantId: v.optional(v.id('apps')),
    userId: v.id('users'),
    questionId: v.id('questions'),
    // Taxonomy fields for aggregates
    themeId: v.optional(v.id('themes')),
    subthemeId: v.optional(v.id('subthemes')),
    groupId: v.optional(v.id('groups')),
  })
    .index('by_user_question', ['userId', 'questionId'])
    .index('by_user', ['userId'])
    .index('by_question', ['questionId'])
    .index('by_tenant', ['tenantId'])
    .index('by_tenant_and_user', ['tenantId', 'userId'])
    // Compound indexes for taxonomy-filtered bookmark queries
    .index('by_user_theme', ['userId', 'themeId'])
    .index('by_user_subtheme', ['userId', 'subthemeId'])
    .index('by_user_group', ['userId', 'groupId']),

  // Table to track user statistics for questions
  userQuestionStats: defineTable({
    // Multi-tenancy
    tenantId: v.optional(v.id('apps')),
    userId: v.id('users'),
    questionId: v.id('questions'),
    hasAnswered: v.boolean(), // Track if user has answered at least once
    isIncorrect: v.boolean(), // Track if the most recent answer was incorrect
    answeredAt: v.number(), // Timestamp for when the question was last answered
    // Taxonomy fields for aggregates
    themeId: v.optional(v.id('themes')),
    subthemeId: v.optional(v.id('subthemes')),
    groupId: v.optional(v.id('groups')),
  })
    .index('by_user_question', ['userId', 'questionId'])
    .index('by_user', ['userId'])
    .index('by_user_incorrect', ['userId', 'isIncorrect'])
    .index('by_user_answered', ['userId', 'hasAnswered'])
    .index('by_tenant', ['tenantId'])
    .index('by_tenant_and_user', ['tenantId', 'userId'])
    .index('by_tenant_and_user_incorrect', [
      'tenantId',
      'userId',
      'isIncorrect',
    ])
    // Compound indexes for taxonomy-filtered queries (enables efficient filtered quiz creation)
    .index('by_user_theme_incorrect', ['userId', 'themeId', 'isIncorrect'])
    .index('by_user_subtheme_incorrect', [
      'userId',
      'subthemeId',
      'isIncorrect',
    ])
    .index('by_user_group_incorrect', ['userId', 'groupId', 'isIncorrect']),

  // Table for pre-computed user statistics counts (Performance optimization)
  userStatsCounts: defineTable({
    // Multi-tenancy - counts are now per-tenant
    tenantId: v.optional(v.id('apps')),
    userId: v.id('users'),

    // Global counts (within tenant)
    totalAnswered: v.number(),
    totalIncorrect: v.number(),
    totalBookmarked: v.number(),

    // By theme counts (using Records for flexibility)
    answeredByTheme: v.record(v.id('themes'), v.number()),
    incorrectByTheme: v.record(v.id('themes'), v.number()),
    bookmarkedByTheme: v.record(v.id('themes'), v.number()),

    // By subtheme counts
    answeredBySubtheme: v.record(v.id('subthemes'), v.number()),
    incorrectBySubtheme: v.record(v.id('subthemes'), v.number()),
    bookmarkedBySubtheme: v.record(v.id('subthemes'), v.number()),

    // By group counts
    answeredByGroup: v.record(v.id('groups'), v.number()),
    incorrectByGroup: v.record(v.id('groups'), v.number()),
    bookmarkedByGroup: v.record(v.id('groups'), v.number()),

    lastUpdated: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_tenant', ['tenantId'])
    .index('by_tenant_and_user', ['tenantId', 'userId']),

  // Admin-managed coupons for checkout
  coupons: defineTable({
    // Multi-tenancy
    tenantId: v.optional(v.id('apps')),
    code: v.string(), // store uppercase
    type: v.union(
      v.literal('percentage'),
      v.literal('fixed'),
      v.literal('fixed_price'),
    ),
    value: v.number(),
    description: v.string(),
    active: v.boolean(),
    validFrom: v.optional(v.number()), // epoch ms
    validUntil: v.optional(v.number()), // epoch ms
    // Usage limits
    maxUses: v.optional(v.number()), // Maximum total uses (null = unlimited)
    maxUsesPerUser: v.optional(v.number()), // Max uses per CPF/email (null = unlimited)
    currentUses: v.optional(v.number()), // Current total usage count
    // Minimum price protection
    minimumPrice: v.optional(v.number()), // Minimum final price after discount
  })
    .index('by_code', ['code'])
    .index('by_tenant', ['tenantId']),

  // Coupon usage tracking
  couponUsage: defineTable({
    couponId: v.id('coupons'),
    couponCode: v.string(),
    orderId: v.id('pendingOrders'),
    userEmail: v.string(),
    userCpf: v.string(),
    discountAmount: v.number(),
    originalPrice: v.number(),
    finalPrice: v.number(),
    usedAt: v.number(),
  })
    .index('by_coupon', ['couponId'])
    .index('by_coupon_user', ['couponCode', 'userCpf'])
    .index('by_email', ['userEmail'])
    .index('by_cpf', ['userCpf']),

  //pricing plans
  pricingPlans: defineTable({
    // Multi-tenancy
    tenantId: v.optional(v.id('apps')),
    name: v.string(),
    badge: v.string(),
    originalPrice: v.optional(v.string()), // Marketing strikethrough price
    price: v.string(),
    installments: v.string(),
    installmentDetails: v.string(),
    description: v.string(),
    features: v.array(v.string()),
    buttonText: v.string(),
    // Extended fields for product identification and access control
    productId: v.string(), // e.g., "ortoqbank_2025", "ortoqbank_2026", "premium_pack" - REQUIRED
    category: v.optional(
      v.union(
        v.literal('year_access'),
        v.literal('premium_pack'),
        v.literal('addon'),
      ),
    ),
    year: v.optional(v.number()), // 2025, 2026, 2027, etc. - kept for productId naming/identification
    // Pricing (converted to numbers for calculations)
    regularPriceNum: v.optional(v.number()),
    pixPriceNum: v.optional(v.number()),
    // Access control - year-based
    accessYears: v.optional(v.array(v.number())), // Array of years user gets access to (e.g., [2026, 2027])
    isActive: v.optional(v.boolean()),
    displayOrder: v.optional(v.number()),
  })
    .index('by_product_id', ['productId'])
    .index('by_category', ['category'])
    .index('by_year', ['year'])
    .index('by_tenant', ['tenantId'])
    .index('by_active', ['isActive']),

  // User Products - Junction table for user-product relationships
  userProducts: defineTable({
    userId: v.id('users'),
    pricingPlanId: v.id('pricingPlans'), // Reference to pricingPlans table
    productId: v.string(), // Reference to pricingPlans.productId for easy lookup
    // Purchase info
    purchaseDate: v.number(),
    paymentGateway: v.union(v.literal('mercadopago'), v.literal('asaas')),
    paymentId: v.string(),
    purchasePrice: v.number(),
    couponUsed: v.optional(v.string()),
    discountAmount: v.optional(v.number()),
    // Access control
    hasAccess: v.boolean(),
    accessGrantedAt: v.number(),
    accessExpiresAt: v.optional(v.number()),
    // Status
    status: v.union(
      v.literal('active'),
      v.literal('expired'),
      v.literal('suspended'),
      v.literal('refunded'),
    ),
    // Metadata
    checkoutId: v.optional(v.string()), // Link to pendingOrders
    notes: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_user_product', ['userId', 'productId'])
    .index('by_user_pricing_plan', ['userId', 'pricingPlanId'])
    .index('by_user_status', ['userId', 'status'])
    .index('by_product', ['productId'])
    .index('by_pricing_plan', ['pricingPlanId'])
    .index('by_payment_id', ['paymentId'])
    .index('by_status', ['status'])
    .index('by_expiration', ['accessExpiresAt']),

  // Pending orders - tracks checkout sessions and payment lifecycle
  pendingOrders: defineTable({
    // Contact info (from checkout)
    email: v.string(), // Contact email from checkout
    cpf: v.string(),
    name: v.string(),
    productId: v.string(), // Product identifier (e.g., "ortoqbank_2025")

    // Address info (required for invoice generation - optional for migration)
    phone: v.optional(v.string()),
    mobilePhone: v.optional(v.string()),
    postalCode: v.optional(v.string()), // CEP
    address: v.optional(v.string()), // Street address
    addressNumber: v.optional(v.string()), // Address number (defaults to "SN" if not provided)

    // Account info (from Clerk after signup)
    userId: v.optional(v.string()), // Clerk user ID (set when claimed)
    accountEmail: v.optional(v.string()), // Account email from Clerk (may differ from contact email)

    // Payment info
    paymentMethod: v.string(), // 'PIX' or 'CREDIT_CARD'
    installmentCount: v.optional(v.number()), // Number of credit card installments (only for CREDIT_CARD)
    asaasPaymentId: v.optional(v.string()), // AsaaS payment ID
    externalReference: v.optional(v.string()), // Order ID for external reference
    originalPrice: v.number(),
    finalPrice: v.number(),

    // PIX payment data (for displaying QR code)
    pixData: v.optional(
      v.object({
        qrPayload: v.optional(v.string()), // PIX copy-paste code
        qrCodeBase64: v.optional(v.string()), // QR code image as base64
        expirationDate: v.optional(v.string()), // When the PIX QR code expires
      }),
    ),

    // Coupon info
    couponCode: v.optional(v.string()), // Coupon code used (if any)
    couponDiscount: v.optional(v.number()), // Discount amount from coupon
    pixDiscount: v.optional(v.number()), // Additional PIX discount

    // State management
    status: v.union(
      v.literal('pending'), // Order created, waiting for payment
      v.literal('paid'), // Payment confirmed
      v.literal('provisioned'), // Access granted
      v.literal('completed'), // Fully processed
      v.literal('failed'), // Payment failed or expired
    ),

    // Timestamps
    createdAt: v.number(), // When order was created
    paidAt: v.optional(v.number()), // When payment was confirmed
    provisionedAt: v.optional(v.number()), // When access was granted
    expiresAt: v.number(), // When this order expires (7 days)
  })
    .index('by_email', ['email'])
    .index('by_user_id', ['userId'])
    .index('by_status', ['status'])
    .index('by_asaas_payment', ['asaasPaymentId'])
    .index('by_external_reference', ['externalReference']),

  // Invoices - tracks nota fiscal (invoice) generation for paid orders
  // IMPORTANT: For installment payments, ONE invoice is generated with the TOTAL value
  invoices: defineTable({
    orderId: v.id('pendingOrders'),
    asaasPaymentId: v.string(),
    asaasInvoiceId: v.optional(v.string()), // Set when invoice is successfully created
    status: v.union(
      v.literal('pending'), // Invoice generation scheduled
      v.literal('processing'), // Being generated by Asaas
      v.literal('issued'), // Successfully issued
      v.literal('failed'), // Generation failed
      v.literal('cancelled'), // Cancelled
    ),
    municipalServiceId: v.string(), // Service ID from Asaas
    serviceDescription: v.string(),
    value: v.number(), // Always the TOTAL value (even for installment payments)
    // Installment information (for reference and observations only)
    installmentNumber: v.optional(v.number()), // Always 1 for installment payments (marks it as installment)
    totalInstallments: v.optional(v.number()), // Total number of installments (for payment info)
    customerName: v.string(),
    customerEmail: v.string(),
    customerCpfCnpj: v.string(),
    // Customer address (required for invoice generation - optional for migration)
    customerPhone: v.optional(v.string()),
    customerMobilePhone: v.optional(v.string()),
    customerPostalCode: v.optional(v.string()), // CEP
    customerAddress: v.optional(v.string()),
    customerAddressNumber: v.optional(v.string()), // Defaults to "SN" if not provided
    invoiceUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    issuedAt: v.optional(v.number()),
  })
    .index('by_order', ['orderId'])
    .index('by_payment', ['asaasPaymentId'])
    .index('by_status', ['status'])
    .index('by_asaas_invoice', ['asaasInvoiceId']),

  // Email invitations - tracks Clerk invitation emails sent after payment
  emailInvitations: defineTable({
    orderId: v.id('pendingOrders'),
    email: v.string(),
    customerName: v.string(),
    status: v.union(
      v.literal('pending'), // About to send
      v.literal('sent'), // Successfully sent
      v.literal('failed'), // Failed after all retries
      v.literal('accepted'), // User registered
    ),
    clerkInvitationId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    errorDetails: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    acceptedAt: v.optional(v.number()),
    retryCount: v.optional(v.number()),
    retrierRunId: v.optional(v.string()), // Track the retrier run ID
  })
    .index('by_order', ['orderId'])
    .index('by_email', ['email'])
    .index('by_status', ['status']),

  // Waitlist - tracks users interested in OrtoClub TEOT
  waitlist: defineTable({
    // Multi-tenancy
    tenantId: v.optional(v.id('apps')),
    name: v.string(),
    email: v.string(),
    whatsapp: v.string(),
    instagram: v.optional(v.string()),
    residencyLevel: v.union(
      v.literal('R1'),
      v.literal('R2'),
      v.literal('R3'),
      v.literal('Já concluí'),
    ),
    subspecialty: v.union(
      v.literal('Pediátrica'),
      v.literal('Tumor'),
      v.literal('Quadril'),
      v.literal('Joelho'),
      v.literal('Ombro e Cotovelo'),
      v.literal('Mão'),
      v.literal('Coluna'),
      v.literal('Pé e Tornozelo'),
    ),
  })
    .index('by_email', ['email'])
    .index('by_tenant', ['tenantId']),

  // Question Error Reports - tracks user-reported issues with questions
  questionErrorReports: defineTable({
    // Multi-tenancy
    tenantId: v.optional(v.id('apps')),
    // Question reference
    questionId: v.id('questions'),
    questionCode: v.optional(v.string()),
    // Reporter info
    reporterId: v.id('users'),
    reporterEmail: v.optional(v.string()),
    // Report content
    description: v.string(),
    screenshotStorageId: v.optional(v.id('_storage')),
    // Status management
    status: v.union(
      v.literal('pending'),
      v.literal('reviewed'),
      v.literal('resolved'),
      v.literal('dismissed'),
    ),
    // Admin review
    reviewedBy: v.optional(v.id('users')),
    reviewedAt: v.optional(v.number()),
    reviewNotes: v.optional(v.string()),
  })
    .index('by_question', ['questionId'])
    .index('by_reporter', ['reporterId'])
    .index('by_status', ['status'])
    .index('by_tenant', ['tenantId'])
    .index('by_tenant_and_status', ['tenantId', 'status']),

  // =============================================================================
  // QUIZ CREATION WORKFLOW TABLES
  // =============================================================================

  // Quiz creation jobs for progress tracking (used by workflow system)
  quizCreationJobs: defineTable({
    userId: v.id('users'),
    tenantId: v.optional(v.id('apps')),
    workflowId: v.optional(v.string()),
    status: v.union(
      v.literal('pending'),
      v.literal('collecting_questions'),
      v.literal('applying_filters'),
      v.literal('selecting_questions'),
      v.literal('creating_quiz'),
      v.literal('completed'),
      v.literal('failed'),
    ),
    progress: v.number(), // 0-100
    progressMessage: v.optional(v.string()),
    // Input params (with optimized hierarchy data)
    input: v.object({
      name: v.string(),
      description: v.string(),
      testMode: v.union(v.literal('study'), v.literal('exam')),
      questionMode: v.union(
        v.literal('all'),
        v.literal('unanswered'),
        v.literal('incorrect'),
        v.literal('bookmarked'),
      ),
      numQuestions: v.optional(v.number()),
      selectedThemes: v.optional(v.array(v.id('themes'))),
      selectedSubthemes: v.optional(v.array(v.id('subthemes'))),
      selectedGroups: v.optional(v.array(v.id('groups'))),
      // PRE-COMPUTED HIERARCHY - eliminates DB reads
      groupToSubtheme: v.optional(v.record(v.id('groups'), v.id('subthemes'))),
      subthemeToTheme: v.optional(v.record(v.id('subthemes'), v.id('themes'))),
    }),
    // Results
    quizId: v.optional(v.id('customQuizzes')),
    questionCount: v.optional(v.number()),
    error: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index('by_user', ['userId'])
    .index('by_workflow', ['workflowId'])
    .index('by_status', ['status'])
    .index('by_tenant', ['tenantId'])
    .index('by_tenant_and_user', ['tenantId', 'userId']),
});
