import * as React from "react"
import { LayoutDashboard, PlusCircle, History, Settings, LogOut } from "lucide-react"
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

const menuItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    url: "/dashboard" as const,
  },
  {
    title: "Criar Notícia",
    icon: PlusCircle,
    url: "/editor/$id" as const,
    params: { id: 'new' }
  },
]

export function AppSidebar() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error("Erro ao sair")
    } else {
      navigate({ to: '/auth' })
    }
  }

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
            FN
          </div>
          <span>FakeNews<span className="text-foreground">Studio</span></span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <Link 
                      to={item.url} 
                      params={'params' in item ? item.params : undefined}
                      className="flex items-center gap-3 py-2"
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/dashboard" className="flex items-center gap-3">
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
