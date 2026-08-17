import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { Toaster } from '@/components/ui/sonner'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    // Check session on every load to ensure persistence
    const { data: { session } } = await supabase.auth.getSession()
    console.log('Session check in _authenticated:', session ? 'Found' : 'Not found')
    
    if (!session) {
      // Check if we have a hash indicating a redirect back from OAuth
      const isAuthRedirect = typeof window !== 'undefined' && (window.location.hash || window.location.search.includes('code='));
      
      if (!isAuthRedirect) {
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
