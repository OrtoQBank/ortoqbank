# Taxonomy Processing System

This modular system handles hierarchical taxonomy filtering for quiz creation
forms.

## 📁 Structure

```
_components/form/
├── utils/
│   └── taxonomyProcessor.ts     # Core processing logic
├── hooks/
│   └── useTaxonomyProcessor.ts  # React integration
├── TestFormClient.tsx           # Form integration
└── README-taxonomy.md           # This documentation
```

## 🔧 How It Works

### 1. **Core Processing Logic** (`utils/taxonomyProcessor.ts`)

Handles the conversion from user selections to backend-compatible format:

```typescript
// Input: User selections from form
const selections: TaxonomyItem[] = [
  { id: 'joelho_id', name: 'Joelho', type: 'theme' },
  { id: 'subjoe_id', name: 'SubJoe', type: 'subtheme' },
  { id: 'subgroupjoe_id', name: 'SubGroupJoe', type: 'group' },
  { id: 'ombro_id', name: 'Ombro', type: 'theme' },
];

// Output: Backend-compatible format
const processed: ProcessedTaxonomy = {
  selectedTaxThemes: ['ombro_id'], // Only Ombro (no children selected)
  selectedTaxSubthemes: [], // Empty
  selectedTaxGroups: ['subgroupjoe_id'], // Only SubGroupJoe (most specific for Joelho)
};
```

### 2. **Processing Modes**

#### Simple Mode (Recommended)

Groups consecutive selections and applies hierarchical logic:

- **Group selected** → Use group only (ignore theme/subtheme)
- **Subtheme selected** → Use subtheme only (ignore theme)
- **Theme only** → Use theme

#### Hierarchical Mode (Advanced)

Requires parent-child relationship data. More sophisticated but needs additional
setup.

### 3. **React Integration** (`hooks/useTaxonomyProcessor.ts`)

Provides form-ready hooks:

```typescript
// In your form component
const { processedTaxonomy, isValid, summary } = useTaxonomyProcessor(
  taxonomySelection,
  { mode: 'simple', debug: true },
);

const createPayload = useQuizPayload();
const payload = createPayload(formData, processedTaxonomy);
```

## 🎯 Usage Example

### In Your Form Component:

```typescript
import { useTaxonomyProcessor, useQuizPayload } from './hooks/useTaxonomyProcessor';
import type { TaxonomyItem } from './utils/taxonomyProcessor';

function MyQuizForm() {
  // Form state
  const taxonomySelection: TaxonomyItem[] = watch('taxonomySelection');

  // Process selections
  const { processedTaxonomy, summary } = useTaxonomyProcessor(taxonomySelection);

  // Create API payload
  const createPayload = useQuizPayload();

  const onSubmit = (data) => {
    const payload = createPayload(data, processedTaxonomy);
    await createCustomQuiz(payload);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Your form fields */}
      <p className="text-sm text-muted-foreground">{summary}</p>
    </form>
  );
}
```

## 🔍 Expected Behavior

### Example 1: Mixed Hierarchy

```typescript
// User selects: Joelho → SubJoe → SubGroupJoe + Ombro
Input: [
  { id: "joelho", type: "theme" },
  { id: "subjoe", type: "subtheme" },
  { id: "subgroupjoe", type: "group" },
  { id: "ombro", type: "theme" }
]

Output: {
  selectedTaxThemes: ["ombro"],        // Ombro theme (standalone)
  selectedTaxGroups: ["subgroupjoe"]   // SubGroupJoe only (most specific)
}

Result: Questions from Ombro theme + SubGroupJoe group only
```

### Example 2: Theme Only

```typescript
Input: [{ id: "joelho", type: "theme" }]
Output: { selectedTaxThemes: ["joelho"] }
Result: All questions from Joelho theme
```

### Example 3: Multiple Groups

```typescript
Input: [
  { id: "group1", type: "group" },
  { id: "group2", type: "group" }
]
Output: { selectedTaxGroups: ["group1", "group2"] }
Result: Questions from both groups
```

## 🛠 Customization

### Adding New Processing Modes

1. Create new function in `taxonomyProcessor.ts`:

```typescript
export function processCustomMode(
  selections: TaxonomyItem[],
): ProcessedTaxonomy {
  // Your custom logic
}
```

2. Update the hook:

```typescript
const result =
  options.mode === 'custom'
    ? processCustomMode(taxonomySelection)
    : processSimpleTaxonomy(taxonomySelection);
```

### Debugging

Enable debug mode to see processing results:

```typescript
const { processedTaxonomy } = useTaxonomyProcessor(selections, {
  mode: 'simple',
  debug: true, // Logs to console
});
```

## 🔗 Backend Integration

The processed taxonomy works with `customQuizzesV2.create`:

```typescript
// The backend receives this processed format
await createCustomQuiz({
  name: 'My Quiz',
  // ... other fields
  selectedTaxThemes: ['theme1'],
  selectedTaxSubthemes: [],
  selectedTaxGroups: ['group1', 'group2'],
});
```

Backend automatically queries the appropriate indexes based on provided IDs.

## ✅ Benefits

1. **Modular**: Each piece has a single responsibility
2. **Reusable**: Use in any form across the app
3. **Type Safe**: Full TypeScript support
4. **Testable**: Pure functions easy to test
5. **Debuggable**: Built-in logging and validation
6. **Efficient**: Client-side filtering reduces network load
