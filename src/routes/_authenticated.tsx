import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { Toaster } from '@/components/ui/sonner'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    // Attempt to get session, allowing a small window for hydration if needed
    let session = null
    const { data } = await supabase.auth.getSession()
    session = data.session

    // If no session, wait a brief moment and check again to be sure it's not a slow hydration
    if (!session && typeof window !== 'undefined') {
      await new Promise(resolve => setTimeout(resolve, 500))
      const { data: retryData } = await supabase.auth.getSession()
      session = retryData.session
    }
    
    if (!session) {
      // Final check for indicators of an in-progress auth flow
      const isAuthCallback = typeof window !== 'undefined' && 
        (window.location.hash.includes('access_token=') || 
         window.location.search.includes('code=') ||
         window.localStorage.getItem('sb-' + import.meta.env['VITE_SUPABASE_PROJECT_ID'] + '-auth-token') !== null);

      if (!isAuthCallback) {
        throw redirect({
          to: '/auth',
          search: {
            redirect: location.href,
          },
        })
      }
    }
    return { session, userId: session?.user?.id }
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
