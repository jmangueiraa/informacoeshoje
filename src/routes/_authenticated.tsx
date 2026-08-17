import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { Toaster } from '@/components/ui/sonner'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    // We check for session presence. If not found, we redirect to auth.
    // persistSession: true in the client ensures the session is kept in localStorage.
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      // Small delay to allow potential hydration of session if it's just slow
      // This is a common pattern for SPAs where the storage read might be async-ish
      const isAuthCallback = typeof window !== 'undefined' && 
        (window.location.hash.includes('access_token=') || window.location.search.includes('code='));

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
