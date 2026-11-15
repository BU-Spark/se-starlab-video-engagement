import type { Metadata } from 'next';
import LoginForm from '../_components/LoginForm';
import { safeNextPath } from '../_components/auth';

export const metadata: Metadata = {
  title: 'Sign in | STAR Lab',
  description: 'Researcher sign-in for the STAR Lab study platform.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <LoginForm next={safeNextPath(next)} />;
}
