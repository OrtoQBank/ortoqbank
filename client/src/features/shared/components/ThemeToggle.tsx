import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { Button } from "./ui/Button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      className="justify-start p-2"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? (
        <>
          <SunIcon className="h-5 w-5" />
          Light Mode
        </>
      ) : (
        <>
          <MoonIcon className="h-5 w-5" />
          Dark Mode
        </>
      )}
    </Button>
  );
}
