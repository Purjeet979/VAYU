import './globals.css';
import 'leaflet/dist/leaflet.css';
import NavBar from './components/NavBar';
import GrapBanner from './components/GrapBanner';
import { ThemeProvider } from './components/ThemeProvider';
import localFont from 'next/font/local';
import Script from 'next/script';
import dynamic from 'next/dynamic';

// ChatbotWidget & WelcomeTutorial are client-only (need window, localStorage, DOM queries).
// ssr:false prevents the SSR/client style-string hydration mismatch.
const ChatbotWidget = dynamic(() => import('./components/ChatbotWidget'), { ssr: false });
const WelcomeTutorial = dynamic(() => import('./components/WelcomeTutorial'), { ssr: false });

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  display: 'swap',
});

export const metadata = {
  title: 'VayuSangam',
  description: '72-hour coupled weather+pollution forecasting for Delhi NCR',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} min-h-screen flex flex-col antialiased bg-background text-foreground`}>
        {/* Puter.js — free serverless AI inference (no API key required) */}
        <Script src="https://js.puter.com/v2/" strategy="beforeInteractive" />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <GrapBanner />
          <NavBar />
          <main className="flex-1 flex flex-col">{children}</main>
          {/* Interactive Guide / Welcome Tutorial */}
          <WelcomeTutorial />
          {/* VayuAI Chatbot — floats on every page */}
          <ChatbotWidget />
        </ThemeProvider>
      </body>
    </html>
  );
}
