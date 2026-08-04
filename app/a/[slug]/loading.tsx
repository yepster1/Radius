export default function Loading() {
  return (
    <main className="mx-auto grid max-w-6xl gap-4 p-6">
      <div className="h-8 w-2/3 animate-pulse rounded bg-gray-4" />
      <div className="h-28 animate-pulse rounded-card bg-gray-4" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-card bg-gray-4" />
        ))}
      </div>
    </main>
  );
}
