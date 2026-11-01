import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'STAR Lab Study',
  description: 'Participant app for short-form video studies',
  appleWebApp: { capable: true, statusBarStyle: 'black' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#000000',
};

export default function TabletLayout({ children }: { children: React.ReactNode }) {
  return children;
}
