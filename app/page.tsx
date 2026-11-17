import { redirect } from 'next/navigation';

/**
 * The site root opens the participant app. Researchers use /researcher, which goes to the
 * login page or, when signed in, the studies list.
 */
export default function HomePage() {
  redirect('/tablet');
}
