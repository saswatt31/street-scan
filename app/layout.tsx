import './globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'StreetScan — Infrastructure Health Monitor',
  description: 'AI-powered infrastructure health monitoring system',
  icons: {
    icon: "/logo.png"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen antialiased text-white" style={{ background: 'var(--bg)' }}>
        <Toaster position="top-right" toastOptions={{
          style: { background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }
        }} />
        {children}
      </body>
    </html>
  );
}

