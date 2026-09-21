import { Component, type ErrorInfo, type ReactNode } from 'react'

type AppErrorBoundaryProps = {
  children: ReactNode
}

type AppErrorBoundaryState = {
  hasError: boolean
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    // Keep the production diagnostic useful without logging user data or provider responses.
    void errorInfo
    console.error('[Slimpossible] render failure', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    })
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-12">
        <section
          aria-labelledby="app-error-title"
          className="w-full rounded-3xl bg-white p-8 shadow-xl shadow-slate-200/60"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Slimpossible
          </p>
          <h1
            className="mt-4 text-3xl font-bold tracking-tight text-slate-950"
            id="app-error-title"
          >
            We could not load this page.
          </h1>
          <p className="mt-4 text-slate-600">
            The page stopped safely. Reload the app or return home to try again.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="rounded-full bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800"
              onClick={() => window.location.reload()}
              type="button"
            >
              Reload app
            </button>
            <a
              className="rounded-full border border-stone-300 px-5 py-3 font-semibold text-slate-700 hover:bg-stone-50"
              href="/"
            >
              Return home
            </a>
          </div>
        </section>
      </main>
    )
  }
}
