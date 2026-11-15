'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import Icon from './Icon';
import { HOME_PATH } from './auth';
import { getSupabase } from './study-repository';
import styles from './StudyBuilder.module.css';
import login from './LoginForm.module.css';

type FormState = { status: 'idle' } | { status: 'busy' } | { status: 'error'; message: string };

/** Email + password sign-in. Only accounts on the researchers list are let in. */
export default function LoginForm({ next }: { next: string }) {
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
      // A network failure surfaces as a bare "Failed to fetch".
      const unreachable = error.name === 'AuthRetryableFetchError' || error.message === 'Failed to fetch';
      setState({
        status: 'error',
        message: unreachable ? 'Could not reach the server. Check the connection and try again.' : error.message,
      });
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
    <div className={styles.workspace}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.bu}>BU</span>
          <span className={styles.brandDivider} />
          <strong>STAR LAB</strong>
        </div>
      </header>
      <main className={login.page}>
        <form className={login.card} onSubmit={signIn} noValidate>
          <h1 className={login.title}>Researcher sign in</h1>

          {!supabase ? (
            <div className={styles.demoNotice}>
              <Icon name="info" size={17} />
              <p>
                Supabase is not configured. Sign-in is disabled. <Link href={HOME_PATH}>Open the local preview</Link>
              </p>
            </div>
          ) : (
            <>
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
                <label htmlFor="login-password">Password</label>
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
        </form>
      </main>
    </div>
  );
}
