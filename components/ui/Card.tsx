export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-card border border-gray-4 bg-white p-6 ${className}`}>
      {children}
    </div>
  );
}
