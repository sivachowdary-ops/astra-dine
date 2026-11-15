/** Shown until the Supabase keys are in .env.local. */
export function NotConfigured() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-md">
        <h1 className="dish text-2xl">Almost ready</h1>
        <p className="text-ink-2 mt-2">Add the Supabase project&apos;s keys to <code>.env.local</code> and restart the server. See README.md.</p>
      </div>
    </main>
  );
}
