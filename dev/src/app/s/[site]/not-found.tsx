export default function SiteNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-5 text-center">
      <div>
        <p className="text-sm font-bold tracking-widest text-primary uppercase">404</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Gym website not found</h1>
        <p className="mt-3 text-muted-foreground">Check the address and try again.</p>
      </div>
    </main>
  );
}
