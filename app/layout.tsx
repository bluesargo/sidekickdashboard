import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sidekick Dashboard',
  description: 'AI coding + business ops usage on your reTerminal ePaper display.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
