import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { checkIsAdmin } from '@/lib/admin.functions'

export const Route = createFileRoute('/_authenticated/admin')({
  beforeLoad: async () => {
    try {
      const isAdmin = await checkIsAdmin();
      if (!isAdmin) {
        throw redirect({
          to: '/dashboard',
        })
      }
    } catch (error) {
      throw redirect({
        to: '/dashboard',
      })
    }
  },
  component: AdminLayout,
})

function AdminLayout() {
  return (
    <div className="p-6 w-full max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Painel Administrativo</h1>
        <p className="text-muted-foreground">
          Gestão global do sistema LinkAfiliado.
        </p>
      </div>
      <Outlet />
    </div>
  )
}
