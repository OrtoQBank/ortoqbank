import { v } from 'convex/values';

import { internalMutation } from './_generated/server';

export const logSize = internalMutation({
  args: {
    payload: v.any(), // Generic input to pass through
  },
  handler: async (ctx, { payload }) => {
    const encoder = new TextEncoder();
    const sizeIn = encoder.encode(JSON.stringify(payload)).length;

    // Simulate or replace with your actual logic
    const result = await someHeavyFunction(payload);

    const sizeOut = encoder.encode(JSON.stringify(result)).length;

    console.log(
      `[BANDWIDTH] In: ${sizeIn} bytes, Out: ${sizeOut} bytes, Total: ${sizeIn + sizeOut} bytes`,
    );

    return result;
  },
});

// Helper function - replace with your actual heavy function logic
async function someHeavyFunction(payload: any) {
  // This is a placeholder - replace with your actual function logic
  // For now, just return the payload as an example
  return payload;
}

// Utility function for inline bandwidth logging
export const logBandwidth = (functionName: string, input: any, output: any) => {
  const encoder = new TextEncoder();
  const sizeIn = encoder.encode(JSON.stringify(input)).length;
  const sizeOut = encoder.encode(JSON.stringify(output)).length;
  console.log(
    `[BANDWIDTH] ${functionName} - In: ${sizeIn} bytes, Out: ${sizeOut} bytes, Total: ${sizeIn + sizeOut} bytes`,
  );
};
