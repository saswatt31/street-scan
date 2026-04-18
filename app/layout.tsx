import './globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'StreetScan — Infrastructure Health Monitor',
  description: 'AI-powered infrastructure health monitoring system',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🛣️</text></svg>"
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

