import type { Metadata } from 'next';
import StudyEditor from '../../../_components/StudyEditor';

export const metadata: Metadata = {
  title: 'Edit study | STAR Lab',
};

export default async function EditStudyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudyEditor studyId={id} />;
}
