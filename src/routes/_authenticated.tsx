import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { Toaster } from '@/components/ui/sonner'

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
        to: '/auth',
        search: {
          redirect: location.href,
        },
      })
    }
    return { session, userId: session.user.id }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </SidebarProvider>
  )
}
