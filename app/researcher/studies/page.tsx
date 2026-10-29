import type { Metadata } from 'next';
import StudyList from '../_components/StudyList';

export const metadata: Metadata = {
  title: 'Studies | STAR Lab',
  description: 'Saved short-form video experiments and their participant runs.',
};

export default function StudiesPage() {
  return <StudyList />;
}
