import type { Metadata } from 'next';
import LibraryPage from '../_components/LibraryPage';

export const metadata: Metadata = {
  title: 'Block library | STAR Lab',
  description: 'Blocks, videos and button icons from earlier studies, ready to import.',
};

export default function BlockLibraryPage() {
  return <LibraryPage />;
}
