import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { Toaster } from '@/components/ui/sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getUserProfile } from '@/lib/links.functions'
import { SubscriptionExpiredCard } from '@/components/subscription/SubscriptionExpiredCard'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    // Attempt to get session
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      // Check if there's any sign of a token in localStorage before redirecting
      const supabaseProjectID = import.meta.env['VITE_SUPABASE_PROJECT_ID'];
      const storageKey = `sb-${supabaseProjectID}-auth-token`;
      const hasTokenInStorage = typeof window !== 'undefined' && !!window.localStorage.getItem(storageKey);
      
      const isAuthCallback = typeof window !== 'undefined' && 
        (window.location.hash.includes('access_token=') || 
         window.location.search.includes('code='));

      // If we have a token or are in a callback, wait a bit longer for the SDK to hydrate
      if (hasTokenInStorage || isAuthCallback) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const { data: { session: retriedSession } } = await supabase.auth.getSession();
        if (retriedSession) return { session: retriedSession, userId: retriedSession.user.id };
      }

      // No session found after checks, redirect to auth
      throw redirect({
        to: '/',
        search: {
          // @ts-ignore - redirect is a valid search param defined in src/routes/index.tsx
          redirect: location.href,
        },
      })
    }
    return { session, userId: session.user.id }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const queryClient = useQueryClient()
  const { data: profile } = useQuery({
    queryKey: ['user-profile'],
    queryFn: () => getUserProfile(),
    refetchOnWindowFocus: true,
  })

  const now = new Date().getTime()
  const userEmail = profile && !('error' in profile) ? (profile.username || '').toLowerCase() : ''
  const isMasterAdmin = userEmail === 'ajpentretedimento@hotmail.com' || 
    (profile && !('error' in profile) && (profile.subscription_type === 'lifetime' || profile.full_name?.toLowerCase() === 'ajp entretenimento'))

  const expDateStr = profile && !('error' in profile)
    ? (profile.subscription_expires_at || profile.trial_expires_at)
    : null

  const effectiveExpDate = expDateStr
    ? new Date(expDateStr).getTime()
    : (profile && !('error' in profile) && profile.created_at
        ? new Date(profile.created_at).getTime() + 30 * 24 * 3600 * 1000
        : now)

  const isTrial = profile && !('error' in profile) && (profile.subscription_type === 'trial_7d' || profile.is_trial === true)
  const isExpired = !isMasterAdmin && profile && !('error' in profile) && (
    (effectiveExpDate > 0 && effectiveExpDate < now) ||
    profile.subscription_status === 'suspended'
  )

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background flex-col md:flex-row">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto flex flex-col">
          {/* Header Mobile - Visível apenas em mobile/tablet (< 768px) */}
          <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4 bg-card/50 backdrop-blur-sm sticky top-0 z-20 md:hidden flex!">
            <SidebarTrigger className="h-9 w-9 flex items-center justify-center text-foreground" />
            <div className="flex items-center gap-2 font-bold text-lg tracking-tight text-primary">
              <div className="w-7 h-7 bg-primary rounded flex items-center justify-center text-primary-foreground text-xs">
                LA
              </div>
              <span>Link<span className="text-foreground">Afiliado</span></span>
            </div>
          </header>
          <div className="flex-1">
            {isExpired ? (
              <div className="p-4 sm:p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[calc(100vh-140px)]">
                <SubscriptionExpiredCard
                  userName={profile && !('error' in profile) ? profile.full_name : undefined}
                  expiresAt={new Date(effectiveExpDate).toISOString()}
                  isTrial={isTrial}
                  onRenewSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['user-profile'] })
                    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
                    queryClient.invalidateQueries({ queryKey: ['user-links'] })
                  }}
                />
              </div>
            ) : (
              <Outlet />
            )}
          </div>
          <footer className="p-4 border-t text-center text-xs text-muted-foreground bg-card/50 flex flex-col gap-1">
            <p>Desenvolvido pela AJP Entretenimento, responsável pela criação e produção deste projeto</p>
            <p className="font-semibold">CONTATO: 19981356505</p>
          </footer>
        </main>
      </div>
      <Toaster />
    </SidebarProvider>
  )
}
