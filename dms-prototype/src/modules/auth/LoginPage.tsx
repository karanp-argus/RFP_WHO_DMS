/**
 * Mock SSO entry point (UC001, UC006).
 *
 * Layout follows /Reference/html_pages/index.html: a 5/7 split with a
 * full-bleed banner on the left and a centred title (8px letter-spacing) plus
 * tagline on the right.
 *
 * The reference shows an email/password form. That is deliberately NOT
 * reproduced: HLR5 requires WHO Single Sign-On via Entra ID, so DMS never
 * collects credentials. UC006 states that a user already signed into the WHO
 * environment needs no further authentication — the button below models that
 * completed handshake.
 */

import { useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DEMO_USERS, useAuthStore } from '@/stores/authStore'
import type { Role } from '@/domain/permissions'

export function LoginPage() {
  const signIn = useAuthStore((s) => s.signIn)
  const navigate = useNavigate()

  const enter = (role: Role) => {
    signIn(role)
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-who-surface md:flex-row">
      {/* Banner — 5/12. The reference uses a photographic banner.png; this is a
          token-built stand-in so the prototype ships no unlicensed imagery.
          The gradient reads from the theme, so it deepens in dark mode with the
          rest of the sidebar palette. */}
      <div className="relative flex h-[35vh] w-full items-end overflow-hidden bg-who-sidebar md:h-auto md:w-5/12">
        <div
          className="absolute inset-0 opacity-30 dark:opacity-45"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 30%, var(--who-on-brand) 0, transparent 45%), radial-gradient(circle at 75% 70%, var(--who-primary-blue) 0, transparent 50%)',
          }}
          aria-hidden
        />
        <div className="relative p-8 text-who-on-brand md:p-12">
          <Building2 className="mb-4 size-9 opacity-90" aria-hidden />
          <p className="text-[length:var(--text-body-lg)] leading-snug font-semibold">
            World Health Organization
          </p>
          <p className="mt-1 max-w-sm text-[length:var(--text-body-sm)] text-who-on-brand/80">
            Health Accounts — tracking health expenditure across 196 countries since 2000.
          </p>
        </div>
      </div>

      {/* Sign-in — 7/12 */}
      <div className="flex w-full flex-1 items-center justify-center p-8 md:w-7/12">
        <div className="w-full max-w-md">
          <div className="text-center">
            <h1 className="text-[length:var(--text-h2)] leading-tight font-bold tracking-[8px] text-who-heading">
              HA DMS
            </h1>
            <p className="mt-3 text-[length:var(--text-body-lg)] text-who-text-muted">
              Data Management System for Health Accounts
            </p>
          </div>

          <div className="mt-10 space-y-3">
            <Button
              size="lg"
              className="h-12 w-full justify-between bg-who-brand text-[length:var(--text-body-lg)] hover:bg-who-brand-hover"
              onClick={() => enter('administrator')}
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-5" aria-hidden />
                Sign in with WHO account
              </span>
              <ArrowRight className="size-5" aria-hidden />
            </Button>

            <p className="text-center text-[length:var(--text-meta)] text-who-text-muted">
              Single Sign-On via Entra ID. Internal staff and external guests alike.
            </p>
          </div>

          {/* Prototype-only affordance. Labelled as such so nobody mistakes it
              for a product feature during the walkthrough. */}
          <div className="mt-10 rounded border border-dashed border-who-hint/60 p-4">
            <p className="text-[length:var(--text-meta)] font-semibold tracking-wide text-who-text-muted uppercase">
              Prototype — enter as
            </p>
            <div className="mt-3 grid gap-2">
              {(Object.keys(DEMO_USERS) as Role[]).map((role) => {
                const u = DEMO_USERS[role]
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => enter(role)}
                    className="flex items-center justify-between rounded border border-who-border px-3 py-2 text-left transition-colors hover:border-who-primary-blue hover:bg-who-page-bg"
                  >
                    <span>
                      <span className="block text-[length:var(--text-body-sm)] font-semibold text-who-heading">
                        {u.displayName}
                      </span>
                      <span className="block text-[length:var(--text-meta)] text-who-text-muted">
                        {u.jobTitle} · {role === 'administrator' ? 'Administrator' : 'Regular user'}
                      </span>
                    </span>
                    <ArrowRight className="size-4 text-who-icon" aria-hidden />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
