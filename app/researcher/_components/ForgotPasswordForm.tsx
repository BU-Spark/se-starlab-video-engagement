'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import AuthFrame from './AuthFrame';
import Icon from './Icon';
import { LOGIN_PATH, RESET_PATH, authErrorMessage } from './auth';
import { getSupabase } from './study-repository';
import styles from './StudyBuilder.module.css';
import auth from './LoginForm.module.css';

type FormState =
  | { status: 'idle' }
  | { status: 'busy' }
  | { status: 'sent'; email: string }
  | { status: 'error'; message: string };

/** Sends a password reset link. The answer is the same whether or not the email has an account. */
export default function ForgotPasswordForm() {
  const [supabase] = useState(getSupabase);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FormState>({ status: 'idle' });

  async function sendLink(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    const address = email.trim();
    setState({ status: 'busy' });
    const { error } = await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: window.location.origin + RESET_PATH,
    });
    if (error) {
      setState({ status: 'error', message: authErrorMessage(error) });
      return;
    }
    setState({ status: 'sent', email: address });
  }

  const busy = state.status === 'busy';

  if (state.status === 'sent') {
    return (
      <AuthFrame title="Check your email">
        <p className={auth.success} role="status">
          If <strong>{state.email}</strong> belongs to a researcher account, a reset link is on its way.
        </p>
        <p className={auth.hint}>
          Open the link in this browser. It works once and expires in one hour. No email after a few minutes? Check
          spam, or ask the lab admin.
        </p>
        <button type="button" className={styles.secondaryButton} onClick={() => setState({ status: 'idle' })}>
          Send another link
        </button>
        <p className={auth.footer}>
          <Link href={LOGIN_PATH} className={auth.textLink}>
            Back to sign in
          </Link>
        </p>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      title="Reset your password"
      intro="Enter the email you sign in with. We will send you a link to choose a new password."
      onSubmit={sendLink}
    >
      {!supabase ? (
        <div className={styles.demoNotice}>
          <Icon name="info" size={17} />
          <p>Supabase is not configured. Password reset is disabled.</p>
        </div>
      ) : (
        <>
          <div className={styles.field}>
            <label htmlFor="forgot-email">Email</label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </div>
          {state.status === 'error' && (
            <p className={styles.errorSummary} role="alert">
              {state.message}
            </p>
          )}
          <button type="submit" className={styles.primaryButton} disabled={busy || !email.trim()}>
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </>
      )}
      <p className={auth.footer}>
        <Link href={LOGIN_PATH} className={auth.textLink}>
          Back to sign in
        </Link>
      </p>
    </AuthFrame>
  );
}
