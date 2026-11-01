import type { Metadata } from 'next';
import RunData from '../../../_components/RunData';

export const metadata: Metadata = {
  title: 'Saved data | STAR Lab',
};

export default async function StudyDataPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RunData studyId={id} />;
}
