import type { Metadata } from 'next';
import StudyBuilder from '../../_components/StudyBuilder';

export const metadata: Metadata = {
  title: 'Create a study | STAR Lab',
  description: 'Build a short-form video experiment with instructions, videos, and surveys.',
};

export default function CreateStudyPage() {
  return <StudyBuilder />;
}
