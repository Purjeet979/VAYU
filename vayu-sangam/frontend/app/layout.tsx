import './globals.css';
import 'leaflet/dist/leaflet.css';
import NavBar from './components/NavBar';
import { ThemeProvider } from './components/ThemeProvider';
import localFont from 'next/font/local';

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
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <NavBar />
          <main className="flex-1 flex flex-col">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
