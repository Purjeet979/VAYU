import './globals.css';
import 'leaflet/dist/leaflet.css';
import NavBar from './components/NavBar';
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
    <html lang="en" className="dark">
      <body className={`${geistSans.className} min-h-screen flex flex-col bg-[#0b0e14] text-gray-100 antialiased`}>
        <NavBar />
        <main className="flex-1 flex flex-col">{children}</main>
        <footer className="border-t border-gray-800 py-8 mt-auto">
          <div className="max-w-6xl mx-auto px-6 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center text-xs text-gray-500">
            <p>© 2026 VayuSangam.</p>
            <div className="flex flex-wrap gap-4">
              <a href="/map" className="hover:text-teal-400">Map</a>
              <a href="/dashboard" className="hover:text-teal-400">Forecast</a>
              <a href="/about" className="hover:text-teal-400">About</a>
              <a href="https://github.com/vayu-sangam/vayu-sangam" className="hover:text-teal-400">GitHub</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
