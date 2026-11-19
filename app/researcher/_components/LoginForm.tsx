'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import AuthFrame from './AuthFrame';
import Icon from './Icon';
import { FORGOT_PATH, HOME_PATH, authErrorMessage } from './auth';
import { getSupabase } from './study-repository';
import styles from './StudyBuilder.module.css';
import auth from './LoginForm.module.css';

type FormState = { status: 'idle' } | { status: 'busy' } | { status: 'error'; message: string };

/** Email + password sign-in. Only accounts on the researchers list are let in. */
export default function LoginForm({ next, passwordReset = false }: { next: string; passwordReset?: boolean }) {
  const router = useRouter();
  const [supabase] = useState(getSupabase);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<FormState>({ status: 'idle' });

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setState({ status: 'busy' });

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setState({ status: 'error', message: authErrorMessage(error) });
      return;
    }

    // A valid account is not enough: the database only serves accounts on the researchers list.
    const { data: allowed, error: checkError } = await supabase.rpc('is_researcher');
    if (checkError || !allowed) {
      await supabase.auth.signOut();
      setState({
        status: 'error',
        message: checkError
          ? 'Could not check your access: ' + checkError.message
          : 'This account is not on the researcher list. Ask the lab admin to add it.',
      });
      return;
    }

    router.replace(next);
    router.refresh();
  }

  const busy = state.status === 'busy';

  return (
    <AuthFrame title="Researcher sign in" onSubmit={signIn}>
      {!supabase ? (
        <div className={styles.demoNotice}>
          <Icon name="info" size={17} />
          <p>
            Supabase is not configured. Sign-in is disabled. <Link href={HOME_PATH}>Open the local preview</Link>
          </p>
        </div>
      ) : (
        <>
          {passwordReset && state.status !== 'error' && (
            <p className={auth.success} role="status">
              Your password was changed. Sign in with the new password.
            </p>
          )}
          <div className={styles.field}>
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className={styles.field}>
            <div className={auth.labelRow}>
              <label htmlFor="login-password" className={styles.fieldLabel}>
                Password
              </label>
              <Link href={FORGOT_PATH} className={auth.textLink}>
                Forgot password?
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </div>
          {state.status === 'error' && (
            <p className={styles.errorSummary} role="alert">
              {state.message}
            </p>
          )}
          <button type="submit" className={styles.primaryButton} disabled={busy || !email || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </>
      )}
    </AuthFrame>
  );
}
