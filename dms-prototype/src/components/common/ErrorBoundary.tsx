/**
 * Error boundary for a routed page.
 *
 * Phase 8 item 2: a prototype that shows a blank pane reads as unfinished, and a
 * white screen in front of an evaluation panel is worse than an ugly one. React
 * unmounts the whole tree on an uncaught render error, so without a boundary a
 * single bad cell renderer takes the sidebar and the header with it and the demo
 * is over.
 *
 * Two deliberate choices:
 *
 *  · **The boundary sits inside the shell, not around it.** The sidebar, header
 *    and role switcher stay mounted, so the recovery is "click another module"
 *    rather than "reload and sign in again".
 *  · **`resetKey` is the pathname.** Class boundaries have no automatic reset,
 *    so a caught error would persist across navigation and every subsequent page
 *    would show the same message. Changing the key clears the caught error, which
 *    makes navigating away the recovery path a user would try first anyway.
 *
 * The message names the module and shows the error text. This is a prototype
 * shown to evaluators: a real stack trace is more honest — and more useful on
 * stage — than "something went wrong".
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  /** Changing this clears a caught error. Pass the route path. */
  resetKey?: string
  /** Named in the message, so the panel knows which module failed. */
  label?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidUpdate(prev: Props) {
    // Navigating to another route clears the error; see the note above.
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No telemetry endpoint in a front-end-only prototype, so the console is the
    // record. Kept deliberately — it is what makes a defect diagnosable when it
    // surfaces during a walkthrough rather than in a test.
    console.error('[DMS] render error', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div
        role="alert"
        className="mx-auto max-w-xl rounded border border-who-fail/40 bg-who-surface p-6 shadow-who-card"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-who-fail" aria-hidden />
          <div className="min-w-0 space-y-3">
            <div>
              <h3 className="text-[length:var(--text-body)] font-semibold text-who-heading">
                {this.props.label ? `${this.props.label} could not be displayed` : 'This page could not be displayed'}
              </h3>
              <p className="mt-1 text-[length:var(--text-meta)] text-who-text-muted">
                The rest of the application is unaffected — the navigation and your unsaved
                workbook edits are still there. Pick another module, or try again.
              </p>
            </div>
            <pre className="overflow-x-auto rounded bg-who-page-bg p-2 font-mono text-[length:var(--text-meta)] text-who-text">
              {error.message || String(error)}
            </pre>
            <Button size="sm" onClick={() => this.setState({ error: null })}>
              <RotateCcw className="size-4" />
              Try again
            </Button>
          </div>
        </div>
      </div>
    )
  }
}
