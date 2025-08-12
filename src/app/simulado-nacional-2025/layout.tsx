import ConvexClientProvider from '@/app/convex-client-provider';

export default function EventLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ConvexClientProvider>{children}</ConvexClientProvider>;
}
