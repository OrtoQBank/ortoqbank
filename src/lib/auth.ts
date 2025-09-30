import { auth } from "@clerk/nextjs/server";

export async function getAuthToken() {
  const authResult = await auth();
  return (await authResult.getToken({ template: "convex" })) ?? undefined;
}
