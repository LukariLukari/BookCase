import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import "./business-layout.css";
import "./theme.css";
import "./rounded.css";
import "./paper.css";
import { themeBootstrapScript } from '@/lib/theme';
import { SOUND_URLS } from '@/lib/soundEffects';
import { PublicThemeToggle } from '@/components/ThemeToggle';

const montserrat = Montserrat({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` :
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'),
  ),
  title: "Billy.",
  description: "Hệ thống quản lý bán hàng thông minh - Billy.",
  appleWebApp: { capable: true, title: 'Billy', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/icons/billy-cat-v3-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/billy-cat-v3-192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/icons/billy-cat-v3-32.png',
    apple: [{ url: '/icons/billy-cat-v3-180.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { AuthProvider } from "./contexts/AuthContext";
import ButtonSoundEffects from "@/components/ButtonSoundEffects";
import MotionProvider from "@/components/MotionProvider";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} font-sans min-h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {Object.values(SOUND_URLS).map(url => <link key={url} rel="preload" href={url} as="fetch" crossOrigin="anonymous" />)}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
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
          <PublicThemeToggle />
          <ButtonSoundEffects />
          <MotionProvider>{children}</MotionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
