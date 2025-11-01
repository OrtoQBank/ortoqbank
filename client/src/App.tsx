import Navbar from "./features/shared/components/Navbar";
import { ThemeProvider } from "./features/shared/components/ThemeProvider";
import { Toaster } from "./features/shared/components/ui/Toaster";

export function App() {
  return (
    <>
      <ThemeProvider defaultTheme="system">
        <Toaster />
        <div className="flex justify-center gap-8 pb-8">
          <Navbar />
          <div className="min-h-screen w-full max-w-2xl">
            <header className="mb-4 border-b border-neutral-200 p-4 dark:border-neutral-800">
              <h1 className="text-center text-xl font-bold">
                Advanced Patterns React
              </h1>
              <p className="text-center text-sm text-neutral-500">
                <b>
                  <span className="dark:text-primary-500">Cosden</span>{" "}
                  Solutions
                </b>
              </p>
            </header>
            <div className="space-y-4 p-4">
              <img
                src="/500w-logo.png"
                alt="logo"
                className="mx-auto h-24 w-24"
              />
              <div className="space-y-2">
                <h1 className="text-center text-2xl font-semibold">
                  Welcome to the course!
                </h1>
                <p className="text-center text-lg text-neutral-500">
                  You're going to build a lot of great things here. Let's get
                  started!
                </p>
              </div>
            </div>
          </div>
        </div>
      </ThemeProvider>
    </>
  );
}
