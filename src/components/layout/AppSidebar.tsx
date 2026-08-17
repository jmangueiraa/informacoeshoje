import * as React from "react"
import { LayoutDashboard, PlusCircle, Link2, BarChart3, Settings, LogOut, CreditCard, Video, ShieldAlert, Globe } from "lucide-react"
import { Link, useNavigate } from "@tanstack/react-router"
import { supabase } from "@/integrations/supabase/client"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar"
import { toast } from "sonner"
import { checkIsAdmin } from "@/lib/admin.functions"
import { useQuery } from "@tanstack/react-query"

export function AppSidebar() {
  const navigate = useNavigate()
  const { data: isAdmin } = useQuery({
    queryKey: ['is-admin'],
    queryFn: () => checkIsAdmin(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error("Erro ao sair")
    } else {
      navigate({ to: '/' })
      window.location.reload() // Ensure all states are cleared
    }
  }

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
            LA
          </div>
          <span>Link<span className="text-foreground">Afiliado</span></span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Dashboard">
                  <Link to="/dashboard" className="flex items-center gap-3 py-2">
                    <LayoutDashboard className="h-5 w-5" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Meus Links">
                  <Link to="/links" className="flex items-center gap-3 py-2">
                    <Link2 className="h-5 w-5" />
                    <span>Meus Links</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Criar Link">
                  <Link to="/links" className="flex items-center gap-3 py-2">
                    <PlusCircle className="h-5 w-5 text-primary" />
                    <span>Criar Link</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Estatísticas">
                  <Link to="/links" className="flex items-center gap-3 py-2">
                    <BarChart3 className="h-5 w-5" />
                    <span>Estatísticas</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Gerador de Play">
                  <Link to="/play-generator" className="flex items-center gap-3 py-2">
                    <Video className="h-5 w-5 text-purple-500" />
                    <span>Gerador de Play</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isAdmin && (
                <SidebarGroup>
                  <SidebarGroupLabel className="text-orange-500/70">Administração</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip="Métricas ADM">
                          <Link to="/admin" className="flex items-center gap-3 py-2 text-orange-500 hover:text-orange-600">
                            <ShieldAlert className="h-5 w-5" />
                            <span>Métricas ADM</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip="Gerenciar Domínios">
                          <Link to="/admin/domains" className="flex items-center gap-3 py-2 text-orange-500 hover:text-orange-600">
                            <Globe className="h-5 w-5" />
                            <span>Gerenciar Domínios</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Configurações">
              <Link to="/settings" className="flex items-center gap-3 py-2">
                <Settings className="h-5 w-5" />
                <span>Configurações</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="text-destructive hover:text-destructive hover:bg-destructive/10">
              <LogOut className="h-5 w-5" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
