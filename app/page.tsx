import { AddressSearch } from '@/components/search/AddressSearch';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-charcoal">
      <nav className="flex items-center gap-5 border-b border-white/10 px-6 py-4">
        <span className="text-base font-bold tracking-[-0.03em] text-white">
          rad<span className="text-accent">ius</span>
        </span>
      </nav>

      <section className="px-6 py-24 text-center">
        <h1 className="mx-auto mb-4 max-w-[16ch] text-4xl text-white sm:text-5xl">
          Know the address before you list it.
        </h1>
        <p className="mx-auto mb-8 max-w-[52ch] text-gray-3">
          Walkability, transit, nearby businesses and renter fit — for any US address, in one page.
        </p>
        <AddressSearch />
      </section>
    </main>
  );
}
