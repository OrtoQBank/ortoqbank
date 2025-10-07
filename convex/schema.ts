import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
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
    status: v.optional(v.union(
      v.literal("invited"),
      v.literal("active"), 
      v.literal("suspended"),
      v.literal("expired")
    )),
  })
    .index('by_clerkUserId', ['clerkUserId'])
    .index('by_paid', ['paid'])
    .index('by_email', ['email'])
    .index('by_status', ['status']),

  themes: defineTable({
    name: v.string(),
    prefix: v.optional(v.string()),
    displayOrder: v.optional(v.number()),
  }).index('by_name', ['name']),

  subthemes: defineTable({
    name: v.string(),
    themeId: v.id('themes'),
    prefix: v.optional(v.string()),
  }).index('by_theme', ['themeId']),

  groups: defineTable({
    name: v.string(),
    subthemeId: v.id('subthemes'),
    prefix: v.optional(v.string()),
  }).index('by_subtheme', ['subthemeId']),

  // Tags table
  tags: defineTable({ name: v.string() }),

  questions: defineTable({
    title: v.string(),
    normalizedTitle: v.string(),
    questionCode: v.optional(v.string()),
    orderedNumberId: v.optional(v.number()),
    questionText: v.optional(v.any()),
    explanationText: v.optional(v.any()),
    questionTextString: v.string(),
    explanationTextString: v.string(),
    contentMigrated: v.optional(v.boolean()),
    alternatives: v.array(v.string()),
    correctAlternativeIndex: v.number(),
    themeId: v.id('themes'),
    subthemeId: v.optional(v.id('subthemes')),
    groupId: v.optional(v.id('groups')),
    authorId: v.optional(v.id('users')),
    isPublic: v.optional(v.boolean()),
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
    .searchIndex('search_by_title', { searchField: 'title' })
    .searchIndex('search_by_code', { searchField: 'questionCode' }),

  presetQuizzes: defineTable({
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
    .searchIndex('search_by_name', { searchField: 'name' }),

  customQuizzes: defineTable({
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
  }).searchIndex('search_by_name', { searchField: 'name' }),

  quizSessions: defineTable({
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
  }).index('by_user_quiz', ['userId', 'quizId', 'isComplete']),

  userBookmarks: defineTable({
    userId: v.id('users'),
    questionId: v.id('questions'),
    // Taxonomy fields for aggregates
    themeId: v.optional(v.id('themes')),
    subthemeId: v.optional(v.id('subthemes')),
    groupId: v.optional(v.id('groups')),
  })
    .index('by_user_question', ['userId', 'questionId'])
    .index('by_user', ['userId'])
    .index('by_question', ['questionId']),

  // Table to track user statistics for questions
  userQuestionStats: defineTable({
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
    .index('by_user_answered', ['userId', 'hasAnswered']),

  // Table for pre-computed user statistics counts (Performance optimization)
  userStatsCounts: defineTable({
    userId: v.id('users'),

    // Global counts
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
  }).index('by_user', ['userId']),

  // Admin-managed coupons for checkout
  coupons: defineTable({
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
  }).index('by_code', ['code']),

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
    category: v.optional(v.union(v.literal("year_access"), v.literal("premium_pack"), v.literal("addon"))),
    year: v.optional(v.number()), // 2025, 2026, 2027, etc.
    // Pricing (converted to numbers for calculations)
    regularPriceNum: v.optional(v.number()),
    pixPriceNum: v.optional(v.number()),
    // Access control
    accessDurationDays: v.optional(v.number()), // How long access lasts
    isActive: v.optional(v.boolean()),
    displayOrder: v.optional(v.number()),
  })
    .index("by_product_id", ["productId"])
    .index("by_category", ["category"])
    .index("by_year", ["year"])
    .index("by_active", ["isActive"]),

  // User Products - Junction table for user-product relationships  
  userProducts: defineTable({
    userId: v.id("users"),
    pricingPlanId: v.id("pricingPlans"), // Reference to pricingPlans table
    productId: v.string(), // Reference to pricingPlans.productId for easy lookup
    // Purchase info
    purchaseDate: v.number(),
    paymentGateway: v.union(v.literal("mercadopago"), v.literal("asaas")),
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
      v.literal("active"),
      v.literal("expired"), 
      v.literal("suspended"),
      v.literal("refunded")
    ),
    // Metadata
    checkoutId: v.optional(v.string()), // Link to pendingOrders
    notes: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_product", ["userId", "productId"])
    .index("by_user_pricing_plan", ["userId", "pricingPlanId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_product", ["productId"])
    .index("by_pricing_plan", ["pricingPlanId"])
    .index("by_payment_id", ["paymentId"])
    .index("by_status", ["status"])
    .index("by_expiration", ["accessExpiresAt"]),

  // Pending orders - tracks checkout sessions and payment lifecycle
  pendingOrders: defineTable({
    // Contact info (from checkout)
    email: v.string(), // Contact email from checkout
    cpf: v.string(),
    name: v.string(),
    productId: v.string(), // Product identifier (e.g., "ortoqbank_2025")
    
    // Account info (from Clerk after signup)
    userId: v.optional(v.string()), // Clerk user ID (set when claimed)
    accountEmail: v.optional(v.string()), // Account email from Clerk (may differ from contact email)
    
    // Payment info
    paymentMethod: v.string(), // 'PIX' or 'CREDIT_CARD'
    asaasPaymentId: v.optional(v.string()), // AsaaS payment ID
    externalReference: v.optional(v.string()), // Order ID for external reference
    originalPrice: v.number(),
    finalPrice: v.number(),
    
    // PIX payment data (for displaying QR code)
    pixData: v.optional(v.object({
      qrPayload: v.optional(v.string()), // PIX copy-paste code
      qrCodeBase64: v.optional(v.string()), // QR code image as base64
      expirationDate: v.optional(v.string()), // When the PIX QR code expires
    })),
    
    // Coupon info
    couponCode: v.optional(v.string()), // Coupon code used (if any)
    couponDiscount: v.optional(v.number()), // Discount amount from coupon
    pixDiscount: v.optional(v.number()), // Additional PIX discount
    
    // State management
    status: v.union(
      v.literal("pending"), // Order created, waiting for payment
      v.literal("paid"), // Payment confirmed
      v.literal("provisioned"), // Access granted
      v.literal("completed"), // Fully processed
      v.literal("failed") // Payment failed or expired
    ),
    
    // Timestamps
    createdAt: v.number(), // When order was created
    paidAt: v.optional(v.number()), // When payment was confirmed
    provisionedAt: v.optional(v.number()), // When access was granted
    expiresAt: v.number(), // When this order expires (7 days)
    
    // Security (claim system)
    claimToken: v.string(), // One-time claim token (UUID)
    claimTokenUsed: v.boolean(), // Whether claim token has been used
    claimTokenExpiresAt: v.number(), // Claim token expiration (7 days)
  })
    .index("by_email", ["email"])
    .index("by_user_id", ["userId"])
    .index("by_claim_token", ["claimToken"])
    .index("by_status", ["status"])
    .index("by_asaas_payment", ["asaasPaymentId"])
    .index("by_external_reference", ["externalReference"]),



});
