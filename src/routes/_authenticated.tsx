import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { Toaster } from '@/components/ui/sonner'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    // getSession() is appropriate for client-side auth state checks
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      // Check if this is an OAuth callback or a recent sign-in to avoid premature redirection
      const isAuthCallback = typeof window !== 'undefined' && 
        (window.location.hash.includes('access_token=') || 
         window.location.search.includes('code=') ||
         window.localStorage.getItem('supabase.auth.token') !== null);

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
