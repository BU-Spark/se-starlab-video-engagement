'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LOGIN_PATH, RESET_PATH } from './auth';
import { getSupabase } from './study-repository';
import styles from './StudyBuilder.module.css';

/** Top-bar badge: the signed-in researcher and a sign-out button (just a badge in local preview). */
export default function AccountMenu() {
  const router = useRouter();
  const [supabase] = useState(getSupabase);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setEmail(data.user?.email ?? null);
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace(LOGIN_PATH);
    router.refresh();
  }

  return (
    <div className={styles.account}>
      <span className={styles.researcherBadge}>
        <span />
        {email ?? 'Researcher workspace'}
      </span>
      {supabase && (
        <>
          <Link href={RESET_PATH} className={styles.accountLink}>
            Change password
          </Link>
          <button type="button" className={styles.secondaryButton} onClick={signOut}>
            Sign out
          </button>
        </>
      )}
    </div>
  );
}
