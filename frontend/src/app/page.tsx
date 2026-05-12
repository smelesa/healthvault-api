import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-16 px-8 bg-white dark:bg-black sm:items-start">
        {/* Hero */}
        <div className="flex flex-col items-center gap-8 text-center sm:items-start sm:text-left">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-bold tracking-tight text-black dark:text-zinc-50">
              Own your health.
            </h1>
            <p className="text-xl font-medium text-zinc-600 dark:text-zinc-400">
              Store, understand, improve.
            </p>
          </div>

          <p className="max-w-lg text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Your personal health record platform — upload lab reports, get AI-powered
            analysis, and chat with your health coach. All your data, encrypted and private.
          </p>

          <div className="flex flex-col gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <span>🔒 End-to-end encrypted</span>
            <span>🇪🇺 GDPR compliant</span>
            <span>💜 Your data stays yours</span>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-4 pt-8">
          <Link
            href="/dashboard"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-black px-5 text-background text-base font-medium transition-colors hover:bg-[#383838] dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200 md:w-[240px]"
          >
            Join Early Access →
          </Link>
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            Free during beta. No credit card required.
          </p>
        </div>
      </main>
    </div>
  );
}