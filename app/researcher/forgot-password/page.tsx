import type { Metadata } from 'next';
import ForgotPasswordForm from '../_components/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Reset password | STAR Lab',
  description: 'Request a password reset link for a STAR Lab researcher account.',
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
