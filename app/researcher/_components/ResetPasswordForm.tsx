'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { EmailOtpType } from '@supabase/supabase-js';
import AuthFrame from './AuthFrame';
import Icon from './Icon';
import {
  FORGOT_PATH,
  LOGIN_PATH,
  MIN_PASSWORD_LENGTH,
  RESET_PATH,
  authErrorMessage,
  passwordProblem,
  readAuthLink,
} from './auth';
import { getSupabase } from './study-repository';
import styles from './StudyBuilder.module.css';
import auth from './LoginForm.module.css';

type PageState =
  | { status: 'checking' }
  | { status: 'invalid'; message: string }
  | { status: 'ready'; email: string | null; invited: boolean }
  | { status: 'saving'; email: string | null; invited: boolean }
  | { status: 'error'; email: string | null; invited: boolean; message: string };

/**
 * Landing page for the links in Supabase emails: "Reset password" and "You have been invited".
 * The link signs the browser in for this one purpose; the researcher then picks a password.
 */
export default function ResetPasswordForm() {
  const router = useRouter();
  const [supabase] = useState(getSupabase);
  const [state, setState] = useState<PageState>(() =>
    supabase ? { status: 'checking' } : { status: 'invalid', message: 'Supabase is not configured.' }
  );
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);

  // Links carry one-time tokens, so read them only once (React runs effects twice in development).
  const started = useRef(false);
  useEffect(() => {
    if (!supabase || started.current) return;
    started.current = true;

    (async () => {
      const link = readAuthLink(window.location.href);
      // Keep the tokens out of the address bar and the browser history.
      if (link.kind !== 'none') window.history.replaceState(null, '', RESET_PATH);

      let invited = false;
      if (link.kind === 'error') {
        setState({ status: 'invalid', message: link.message });
        return;
      }
      if (link.kind === 'tokens') {
        // Invite links use the implicit flow, which this PKCE client does not pick up by itself.
        invited = link.type === 'invite' || link.type === 'signup';
        const { error } = await supabase.auth.setSession({
          access_token: link.accessToken,
          refresh_token: link.refreshToken,
        });
        if (error) {
          setState({ status: 'invalid', message: authErrorMessage(error) });
          return;
        }
      } else if (link.kind === 'tokenHash') {
        invited = link.type === 'invite' || link.type === 'signup';
        const { error } = await supabase.auth.verifyOtp({
          token_hash: link.tokenHash,
          type: link.type as EmailOtpType,
        });
        if (error) {
          setState({ status: 'invalid', message: authErrorMessage(error) });
          return;
        }
      }
      // For ?code= links the client has already exchanged the code while starting up.

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setState({
          status: 'invalid',
          message:
            link.kind === 'code'
              ? 'This link could not be used. Open it in the same browser you requested it from, or request a new one.'
              : 'Open the link from your email to choose a new password.',
        });
        return;
      }
      setState({ status: 'ready', email: session.user.email ?? null, invited });
    })();
  }, [supabase]);

  const problem = passwordProblem(password, confirm);

  async function save(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!supabase || problem || (state.status !== 'ready' && state.status !== 'error')) return;
    const { email, invited } = state;
    setState({ status: 'saving', email, invited });

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setState({ status: 'error', email, invited, message: authErrorMessage(error) });
      return;
    }
    // Sign out of the link's session so the next sign-in uses the new password.
    await supabase.auth.signOut();
    router.replace(LOGIN_PATH + '?reset=done');
    router.refresh();
  }

  if (state.status === 'checking') {
    return (
      <AuthFrame title="Choose a new password">
        <p className={auth.hint} role="status">
          Checking your link…
        </p>
      </AuthFrame>
    );
  }

  if (state.status === 'invalid') {
    return (
      <AuthFrame title="This link can’t be used">
        {supabase ? (
          <p className={styles.errorSummary} role="alert">
            {state.message}
          </p>
        ) : (
          <div className={styles.demoNotice}>
            <Icon name="info" size={17} />
            <p>{state.message}</p>
          </div>
        )}
        {supabase && (
          <Link href={FORGOT_PATH} className={`${styles.primaryButton} ${auth.linkButton}`}>
            Request a new link
          </Link>
        )}
        <p className={auth.footer}>
          <Link href={LOGIN_PATH} className={auth.textLink}>
            Back to sign in
          </Link>
        </p>
      </AuthFrame>
    );
  }

  const saving = state.status === 'saving';
  const showProblem = touched && problem;

  return (
    <AuthFrame
      title={state.invited ? 'Set your password' : 'Choose a new password'}
      intro={
        state.email ? (
          <>
            For <strong>{state.email}</strong>
          </>
        ) : undefined
      }
      onSubmit={save}
    >
      {/* Lets password managers save the new password under the right account. */}
      <input type="email" autoComplete="username" value={state.email ?? ''} readOnly hidden />
      <div className={styles.field}>
        <label htmlFor="new-password">New password</label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby="new-password-hint"
          disabled={saving}
        />
        <p id="new-password-hint" className={auth.hint}>
          At least {MIN_PASSWORD_LENGTH} characters.
        </p>
      </div>
      <div className={styles.field}>
        <label htmlFor="confirm-password">Confirm new password</label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onBlur={() => confirm && setTouched(true)}
          aria-invalid={showProblem ? true : undefined}
          disabled={saving}
        />
      </div>
      {(showProblem || state.status === 'error') && (
        <p className={styles.errorSummary} role="alert">
          {showProblem ? problem : state.status === 'error' ? state.message : null}
        </p>
      )}
      <button type="submit" className={styles.primaryButton} disabled={saving || !password || !confirm}>
        {saving ? 'Saving…' : 'Save password'}
      </button>
    </AuthFrame>
  );
}
