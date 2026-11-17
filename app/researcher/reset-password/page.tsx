import type { Metadata } from 'next';
import ResetPasswordForm from '../_components/ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Choose a password | STAR Lab',
  description: 'Set a new password for a STAR Lab researcher account.',
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
