# E2E Tests for OrtoQBank Checkout

## Overview

Comprehensive end-to-end tests for the critical checkout page covering:
- Form validation
- Payment method selection (PIX & Credit Card)
- Coupon validation
- Card formatting and validation
- Address auto-filling
- Responsive design
- Accessibility

## Running Tests

### Run all tests
```bash
npm run test:e2e
```

### Run tests in UI mode (interactive)
```bash
npm run test:e2e:ui
```

### Run specific test file
```bash
npx playwright test checkout.spec.ts
```

### Run specific test by name
```bash
npx playwright test -g "should format card number with spaces"
```

### Run tests in headed mode (see browser)
```bash
npx playwright test --headed
```

### Run tests on specific browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Coverage

### ✅ Initial State Tests
- Page loads successfully with real plan ID
- All form fields are visible
- PIX is selected by default
- Credit card fields hidden initially

### ✅ Form Validation Tests
- Empty required fields validation
- Name length validation (min 2 chars)
- Email format validation
- CPF auto-formatting and validation
- Phone number length validation (min 10 digits)
- Postal code validation (8 digits)
- Address length validation (min 5 chars)

### ✅ Payment Method Tests
- Switch from PIX to Credit Card
- Switch back from Credit Card to PIX
- Installments options appear for credit card
- Price updates correctly

### ✅ Credit Card Validation Tests
- **Card number formatting with spaces** ✅
- **19-digit card support (maxLength=23)** ✅
- Invalid card number validation
- Expired date validation
- CVV length validation (3-4 digits)
- Expiry date auto-formatting (MM/YY)

### ✅ Coupon Tests
- Coupon input field exists
- Apply button behavior
- Loading state during validation
- Remove applied coupon

### ✅ Complete Flow Tests
- PIX payment flow with valid data
- Credit Card payment flow with valid data
- Credit card preview displays correctly

### ✅ Responsive Design Tests
- Mobile viewport (375x667)
- Tablet viewport (768x1024)
- All elements usable on small screens

### ✅ Error Handling Tests
- Network error handling
- Missing plan ID handling
- Submit button disabled during processing

### ✅ Accessibility Tests
- Proper form labels
- Keyboard navigation
- ARIA attributes on validation errors

## Test Data

### Valid Test Card Numbers
- **16-digit Visa**: `4111111111111111`
- **19-digit Visa**: `4111111111111111111` (tests maxLength fix)

### Valid Test Data
```javascript
{
  name: 'João Silva',
  email: 'joao.silva@example.com',
  cpf: '12345678901', // Auto-formats to 123.456.789-01
  phone: '11987654321', // Auto-formats to (11) 98765-4321
  postalCode: '01310100', // Auto-formats to 01310-100
  address: 'Avenida Paulista',
  addressNumber: '1578',
  cardNumber: '4111111111111111',
  cardExpiry: '12/25',
  cardCvv: '123',
}
```

## Recent Fixes Tested

### ✅ Card Number maxLength Fix
**Issue**: Card input was capped at 19 characters, preventing 17-19 digit cards  
**Fix**: Increased maxLength from 19 to 23 to accommodate formatting spaces  
**Test**: Successfully tested with 19-digit card number

### ✅ Simplified Validation with card-validator
**Issue**: Bloated custom validation logic (~100 lines)  
**Fix**: Replaced with `card-validator` library from Braintree  
**Test**: All validation tests pass with new library

### ✅ TypeScript Type Safety
**Issue**: Variables typed as `any` (appliedCoupon, validateResult, payment)  
**Fix**: Created proper TypeScript interfaces based on Convex return types  
**Test**: No TypeScript errors, full type safety

## CI/CD Integration

Tests are configured to run on CI with:
- Automatic retries (2x on CI)
- Parallel execution disabled on CI for stability
- HTML report generation
- Trace collection on failures

## Debugging Failed Tests

### View test traces
```bash
npx playwright show-trace trace.zip
```

### Run with debug mode
```bash
npx playwright test --debug
```

### Generate test code
```bash
npx playwright codegen http://localhost:3000/checkout?plan=TEOT2027R2
```

## Notes

- Tests use real plan ID: `TEOT2027R2`
- Dev server must be running on `http://localhost:3000`
- Some tests may require valid Convex data
- Mock external APIs for consistent test results

## Screenshots

Test screenshots are saved to `.playwright-mcp/` directory during MCP-based testing.

## Known Limitations

- Payment gateway integration not mocked (tests stop at form submission)
- CEP lookup requires internet connection
- Some tests may fail if Convex database is empty

## Contributing

When adding new tests:
1. Follow existing test structure and naming
2. Use descriptive test names
3. Add appropriate comments for complex interactions
4. Update this README with new test coverage
5. Ensure tests are deterministic and don't rely on external state

