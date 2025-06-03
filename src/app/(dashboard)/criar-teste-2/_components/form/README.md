# React Hook Form - FormProvider & useFormContext Pattern

This implementation demonstrates the best practices for using React Hook Form's
`FormProvider` and `useFormContext` for managing deeply nested form components
without prop drilling and avoiding `useState`.

## 🏗️ Architecture Overview

### FormProvider Pattern

- **Main Form Container**: `TestFormClient.tsx` - Wraps the entire form with
  `FormProvider`
- **Nested Components**: All child components use `useFormContext` to access
  form methods
- **No useState**: All state management is handled by React Hook Form's built-in
  state

## 📁 Component Structure

```
form/
├── TestFormClient.tsx          # Main form container with FormProvider
├── ModeToggle.tsx             # Uses useFormContext for mode selection
├── FilterRadioGroup.tsx       # Uses useFormContext for filter options
├── QuestionCountInput.tsx     # Uses useFormContext with validation
├── FormSubmissionStatus.tsx   # Displays form state using useFormContext
├── FormActions.tsx            # Reusable form actions with useFormContext
├── DebugPanel.tsx             # Debug panel showing all form state
└── ConnectForm.tsx            # Render prop component for form access
```

## 🎯 Key Implementation Details

### 1. FormProvider Setup (TestFormClient.tsx)

```typescript
const methods = useForm<FormData>({
  defaultValues: {
    mode: 'exam',
    filter: 'all',
    taxonomySelection: [],
    totalQuestions: 20,
  },
});

return (
  <FormProvider {...methods}>
    {/* All nested components can access form methods */}
  </FormProvider>
);
```

### 2. Accessing Form State in Nested Components

```typescript
// Instead of prop drilling, use useFormContext
const {
  register,
  watch,
  setValue,
  formState: { errors, isSubmitting, isDirty, isValid },
} = useFormContext();
```

### 3. No useState - Using Built-in Form State

```typescript
// ❌ Don't do this
const [isSubmitting, setIsSubmitting] = useState(false);

// ✅ Use form's built-in state instead
const {
  formState: { isSubmitting },
} = useFormContext();
```

## 🧩 Component Examples

### Basic Field Component (ModeToggle.tsx)

```typescript
export function ModeToggle() {
  const { watch, setValue } = useFormContext();
  const value = watch('mode') as 'exam' | 'study';

  return (
    <Switch
      checked={value === 'study'}
      onCheckedChange={checked =>
        setValue('mode', checked ? 'study' : 'exam', {
          shouldDirty: true,
        })
      }
    />
  );
}
```

### Form State Display Component (FormSubmissionStatus.tsx)

```typescript
export function FormSubmissionStatus() {
  const {
    formState: { isSubmitting, isValid, isDirty, errors },
  } = useFormContext();

  if (isSubmitting) {
    return <Alert>Creating your test...</Alert>;
  }
  // ... other states
}
```

### Reusable Actions Component (FormActions.tsx)

```typescript
export function FormActions({ submitText = 'Submit' }) {
  const {
    reset,
    formState: { isSubmitting, isDirty, isValid },
  } = useFormContext();

  return (
    <div>
      <Button onClick={reset} disabled={!isDirty}>
        Reset
      </Button>
      <Button type="submit" disabled={isSubmitting || !isValid}>
        {submitText}
      </Button>
    </div>
  );
}
```

### Render Prop Pattern (ConnectForm.tsx)

```typescript
// Usage in deeply nested components
<ConnectForm>
  {({ register, formState }) => (
    <input {...register('fieldName')} />
  )}
</ConnectForm>
```

## 📋 Best Practices Implemented

### ✅ Do's

- Use `FormProvider` to wrap your entire form
- Use `useFormContext` in nested components instead of prop drilling
- Leverage `formState.isSubmitting` instead of `useState`
- Use `shouldDirty: true` when setting values programmatically
- Access form state consistently through `useFormContext`
- Create reusable components that work with the form context

### ❌ Don'ts

- Don't use `useState` for form-related state
- Don't pass form methods as props through multiple component levels
- Don't manually manage submission state
- Don't forget to wrap components with `FormProvider`

## 🔍 Form State Management

The form automatically manages:

- **isSubmitting**: True during form submission
- **isDirty**: True when form has been modified
- **isValid**: True when all validations pass
- **errors**: Object containing validation errors
- **touchedFields**: Fields that have been interacted with

## 🚀 Benefits of This Approach

1. **No Prop Drilling**: Components access form methods directly via context
2. **Cleaner Code**: No manual state management with `useState`
3. **Better Performance**: React Hook Form optimizes re-renders
4. **Type Safety**: Full TypeScript support with form data types
5. **Reusability**: Components can be used in any form with `FormProvider`
6. **Consistency**: All form state is managed in one place

## 📖 Reference

This implementation follows the patterns described in the
[React Hook Form documentation](https://react-hook-form.com/advanced-usage#FormProviderPerformance)
for deeply nested forms and performance optimization.
