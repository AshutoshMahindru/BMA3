import "./globals.css";

export const metadata = {
  title: "FPE Executive Dashboard",
  description: "Financial Performance Projection Engine",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-50">{children}</body>
    </html>
  );
}
