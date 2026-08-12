import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ToastProvider } from '../components/ui/toast';
import './styles.css';

export const metadata: Metadata = {
  title: 'PromptLens',
  description: 'Understand, improve and organize every prompt.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
