/* eslint-disable import/export */
import type { RenderOptions } from '@testing-library/react';
import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

import { AllTestProviders } from './test-providers';

/**
 * Custom render options with provider configuration
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /**
   * Whether to wrap the component with test providers (Convex, Clerk, etc.)
   * @default true
   */
  withProviders?: boolean;

  /**
   * Options to pass to Convex provider
   */
  convexOptions?: any;

  /**
   * Options to pass to Clerk provider
   */
  clerkOptions?: any;

  /**
   * Custom wrapper component (overrides default provider wrapper)
   */
  wrapper?: (props: { children: ReactNode }) => JSX.Element;
}

/**
 * Enhanced render function that wraps components with necessary providers
 */
const customRender = (
  ui: ReactElement,
  {
    withProviders = true,
    convexOptions = {},
    clerkOptions = {},
    wrapper,
    ...options
  }: CustomRenderOptions = {},
) => {
  // Use custom wrapper if provided, otherwise use AllTestProviders if enabled
  const Wrapper = ({ children }: { children: ReactNode }) => {
    if (wrapper) {
      return wrapper({ children });
    }

    if (withProviders) {
      return (
        <AllTestProviders
          convexOptions={convexOptions}
          clerkOptions={clerkOptions}
        >
          {children}
        </AllTestProviders>
      );
    }

    return <>{children}</>;
  };

  return render(ui, {
    wrapper: Wrapper,
    ...options,
  });
};

// re-export everything
export * from '@testing-library/react';

// override render method
export { customRender as render };
export { default as userEvent } from '@testing-library/user-event';

// Export test utilities
export { AllTestProviders, MockConvexProvider, MockClerkProvider } from './test-providers';
export * from './mock-factories';
