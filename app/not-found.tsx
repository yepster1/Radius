import Link from 'next/link';
import { SiteNav } from '@/components/ui/SiteNav';

export default function NotFound() {
  return (
    <main className="min-h-screen">
      <SiteNav />

      <div className="mx-auto max-w-xl p-16 text-center">
        <h1 className="mb-3 text-3xl">Address not found</h1>
        <p className="mb-6 text-gray-2">
          That link does not contain a valid location. Radius covers US addresses only.
        </p>
        <Link href="/" className="font-mono text-sm text-accent">
          ← Search for an address
        </Link>
      </div>
    </main>
  );
}
