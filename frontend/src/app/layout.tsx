import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, VT323 } from "next/font/google";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-be-vietnam",
});

const vt323 = VT323({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: "400",
  variable: "--font-pixel",
});

export const metadata: Metadata = {
  title: "Billy.",
  description: "Hệ thống quản lý bán hàng thông minh - Billy.",
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
      className={`${beVietnam.variable} ${vt323.variable} font-sans min-h-full antialiased`}
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
      <body className="min-h-full flex flex-col bg-[#F5EEDD] text-[#16587B] font-sans" suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
