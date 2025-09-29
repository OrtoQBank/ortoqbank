import { getAuthToken } from "@/lib/auth";
import { preloadQuery } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import ProfilePage from "./ProfilePage";

export async function ProfileWrapper() {
  const token = await getAuthToken();
  
  // Preload both user stats and weekly progress with authentication
  const preloadedUserStats = await preloadQuery(
    api.userStats.getUserStatsFast,
    {},
    { token }
  );
  
  const preloadedWeeklyProgress = await preloadQuery(
    api.userStats.getUserWeeklyProgress,
    {},
    { token }
  );

  return (
    <ProfilePage 
      preloadedUserStats={preloadedUserStats}
      preloadedWeeklyProgress={preloadedWeeklyProgress}
    />
  );
}
