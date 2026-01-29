import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to operator console as the primary interface
  redirect('/operator');
}
