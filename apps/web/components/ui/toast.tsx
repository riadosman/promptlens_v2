'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type ToastOptions = {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
};

type ToastContextValue = {
  toast: (options: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [items, setItems] = useState<Array<ToastOptions & { id: number }>>([]);

  const toast = useCallback((options: ToastOptions) => {
    const id = Date.now();
    setItems((current) => [...current, { ...options, id }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 3500);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
        {items.map((item) => (
          <div className={`toast ${item.variant === 'destructive' ? 'toast-destructive' : ''}`} key={item.id} role="status">
            <strong className="toast-title">{item.title}</strong>
            {item.description ? <span className="toast-description">{item.description}</span> : null}
            <button className="toast-close" type="button" aria-label="Close notification" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
