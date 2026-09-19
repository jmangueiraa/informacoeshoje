import { createFileRoute, Outlet, redirect, Link } from '@tanstack/react-router'
import { checkIsSuperAdmin } from '@/lib/superadmin.functions'
import { ShieldCheck, BarChart3, Users, Settings, Globe } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/admin')({
  beforeLoad: async () => {
    try {
      const isSuperAdmin = await checkIsSuperAdmin();
      if (!isSuperAdmin) {
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
  component: SuperAdminLayout,
})

function SuperAdminLayout() {
  return (
    <div className="p-4 sm:p-6 w-full max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Painel SuperAdmin (Revenda)</h1>
            <span className="bg-orange-500/10 text-orange-600 border border-orange-500/20 text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Master
            </span>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Gestão financeira, controle de mensalidades (R$ 30/mês), testes de 7 dias e automações.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/admin/domains"
            className="text-xs sm:text-sm font-medium px-3 py-2 border rounded-lg hover:bg-muted transition-colors flex items-center gap-1.5"
          >
            <Globe className="w-4 h-4 text-primary" />
            Gerenciar Domínios
          </Link>
        </div>
      </div>
      <Outlet />
    </div>
  )
}
