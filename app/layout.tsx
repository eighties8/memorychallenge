import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Brain Train',
  description: 'A fast, lightweight memory training game built with Next.js and React',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
