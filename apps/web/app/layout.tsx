import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import type { ReactNode } from 'react';
import './styles.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PromptLens',
  description: 'Understand, improve and organize every prompt.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html className={poppins.variable} lang="en">
      <body>{children}</body>
    </html>
  );
}
