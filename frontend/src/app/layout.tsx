import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin", "vietnamese"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "BOOKCASE.",
  description: "Thư viện sách điện tử cá nhân của bạn.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { AuthProvider } from "./contexts/AuthContext";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} font-sans h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              const originalError = console.error;
              console.error = (...args) => {
                if (typeof args[0] === 'string' && (args[0].includes('bis_skin_checked') || args[0].includes('hydration') || args[0].includes('Hydration'))) {
                  return;
                }
                originalError.apply(console, args);
              };
              window.addEventListener('error', (e) => {
                if (e.message && (e.message.includes('bis_skin_checked') || e.message.toLowerCase().includes('hydration'))) {
                  e.stopImmediatePropagation();
                }
              });
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-[#f8f7f4] text-black flex flex-col" suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
