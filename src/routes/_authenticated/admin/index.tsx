import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  getSuperAdminFinancialStats, 
  getSuperAdminUsersList, 
  createSuperAdminUser, 
  renewUserSubscription, 
  updateSuperAdminUser, 
  deleteSuperAdminUser, 
  getAdminSettings, 
  updateAdminSettings 
} from '@/lib/superadmin.functions'
import { testTelegramBot } from '@/lib/telegram.functions'
import { testMercadoPagoToken } from '@/lib/mercadopago.functions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  ShieldAlert, 
  UserPlus, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Search, 
  MessageSquare, 
  MoreVertical, 
  Edit3, 
  Trash2, 
  Copy, 
  Bot, 
  CreditCard, 
  QrCode, 
  Send, 
  Key, 
  Calendar,
  AlertTriangle,
  Zap,
  Phone,
  Sparkles,
  Loader2
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export const Route = createFileRoute('/_authenticated/admin/')({
  component: SuperAdminDashboard,
})

function SuperAdminDashboard() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('financeiro')
  const [userSearchTerm, setUserSearchTerm] = useState('')
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'expired' | 'trial' | 'suspended'>('all')

  // Modais de Criação e Edição
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false)
  const [createdUserCredentials, setCreatedUserCredentials] = useState<{ email: string; pass: string; name: string } | null>(null)
  
  const [newUserForm, setNewUserForm] = useState({
    full_name: '',
    email: '',
    password: '',
    phone_number: '',
    plan_type: 'monthly' as 'trial_7d' | 'monthly' | 'quarterly' | 'yearly' | 'custom',
    price: 30.00,
    notes: '',
  })

  // Usuário selecionado para edição / renovação
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  const [isEditUserOpen, setIsEditUserOpen] = useState(false)
  const [isRenewOpen, setIsRenewOpen] = useState(false)
  const [renewDays, setRenewDays] = useState(30)

  // Formulário controlado de edição
  const [editForm, setEditForm] = useState({
    userId: '',
    full_name: '',
    phone_number: '',
    subscription_status: 'active' as 'active' | 'expired' | 'trial' | 'suspended',
    subscription_type: 'monthly',
    subscription_price: 30.00,
    subscription_expires_at: '',
    new_password: '',
  })

  const handleOpenEditUser = (user: any) => {
    setSelectedUser(user)
    const dateVal = user.subscription_expires_at 
      ? new Date(user.subscription_expires_at).toISOString().split('T')[0] 
      : ''
    
    let initialStatus: 'active' | 'expired' | 'trial' | 'suspended' = 'active'
    if (user.subscription_status === 'suspended') initialStatus = 'suspended'
    else if (user.subscription_status === 'expired' || user.is_expired) initialStatus = 'expired'
    else if (user.subscription_status === 'trial' || user.is_trial) initialStatus = 'trial'

    setEditForm({
      userId: user.id,
      full_name: user.full_name || '',
      phone_number: user.phone_number || '',
      subscription_status: initialStatus,
      subscription_type: user.subscription_type || 'monthly',
      subscription_price: Number(user.subscription_price) || 30.00,
      subscription_expires_at: dateVal,
      new_password: '',
    })
    setIsEditUserOpen(true)
  }

  // Configurações de API (Telegram e Mercado Pago)
  const [settingsForm, setSettingsForm] = useState({
    telegram_bot_token: '',
    telegram_chat_id: '',
    mercadopago_access_token: '',
    mercadopago_public_key: '',
    pix_key: '',
    support_whatsapp: '5519981356505',
    default_monthly_price: 30.00,
  })
  const [testingTelegram, setTestingTelegram] = useState(false)
  const [testingMp, setTestingMp] = useState(false)

  // Queries
  const { data: stats, isLoading: isLoadingStats, refetch: refetchStats } = useQuery({
    queryKey: ['superadmin-stats'],
    queryFn: () => getSuperAdminFinancialStats(),
  })

  const { data: users, isLoading: isLoadingUsers, refetch: refetchUsers } = useQuery({
    queryKey: ['superadmin-users'],
    queryFn: () => getSuperAdminUsersList(),
  })

  const { data: adminSettings, isLoading: isLoadingSettings, refetch: refetchSettings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const s = await getAdminSettings()
      if (s) {
        setSettingsForm({
          telegram_bot_token: s.telegram_bot_token || '',
          telegram_chat_id: s.telegram_chat_id || '',
          mercadopago_access_token: s.mercadopago_access_token || '',
          mercadopago_public_key: s.mercadopago_public_key || '',
          pix_key: s.pix_key || '',
          support_whatsapp: s.support_whatsapp || '5519981356505',
          default_monthly_price: Number(s.default_monthly_price) || 30.00,
        })
      }
      return s
    },
  })

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: (data: typeof newUserForm) => createSuperAdminUser({ data }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-users'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-stats'] })
      setCreatedUserCredentials({ email: res.email, pass: res.password, name: newUserForm.full_name })
      toast.success("Usuário criado com sucesso!")
      setNewUserForm({
        full_name: '',
        email: '',
        password: '',
        phone_number: '',
        plan_type: 'monthly',
        price: 30.00,
        notes: '',
      })
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao criar usuário.")
    }
  })

  const renewMutation = useMutation({
    mutationFn: (data: { userId: string; daysToAdd: number; price: number; planType: string }) => 
      renewUserSubscription({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-users'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-stats'] })
      toast.success(`Assinatura renovada por +${renewDays} dias com sucesso!`)
      setIsRenewOpen(false)
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao renovar assinatura.")
    }
  })

  const updateUserMutation = useMutation({
    mutationFn: (data: any) => updateSuperAdminUser({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-users'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-stats'] })
      toast.success("Dados do usuário atualizados com sucesso!")
      setIsEditUserOpen(false)
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao atualizar dados.")
    }
  })

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => deleteSuperAdminUser({ data: userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-users'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-stats'] })
      toast.success("Usuário excluído com sucesso!")
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao excluir usuário.")
    }
  })

  const saveSettingsMutation = useMutation({
    mutationFn: (data: typeof settingsForm) => updateAdminSettings({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      toast.success("Configurações salvas com sucesso!")
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao salvar configurações.")
    }
  })

  // Gerar senha aleatória
  const generateRandomPassword = () => {
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#'
    let pass = ''
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setNewUserForm(prev => ({ ...prev, password: pass }))
  }

  // Testar Telegram
  const handleTestTelegram = async () => {
    setTestingTelegram(true)
    try {
      await testTelegramBot({
        data: {
          botToken: settingsForm.telegram_bot_token,
          chatId: settingsForm.telegram_chat_id,
        }
      })
      toast.success("✅ Notificação enviada com sucesso no Telegram!")
    } catch (err: any) {
      toast.error(`Falha no envio: ${err.message}`)
    } finally {
      setTestingTelegram(false)
    }
  }

  // Testar Mercado Pago
  const handleTestMp = async () => {
    setTestingMp(true)
    try {
      const res = await testMercadoPagoToken({
        data: { accessToken: settingsForm.mercadopago_access_token }
      })
      toast.success(`✅ Conectado ao Mercado Pago (${res.nickname})!`)
    } catch (err: any) {
      toast.error(`Token inválido: ${err.message}`)
    } finally {
      setTestingMp(false)
    }
  }

  // Filtragem de Usuários
  const filteredUsers = (users || []).filter(u => {
    const matchesSearch = 
      u.full_name?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      u.phone_number?.includes(userSearchTerm);

    if (!matchesSearch) return false;

    if (userFilter === 'active') return u.subscription_status === 'active' && !u.is_expired && !u.is_trial;
    if (userFilter === 'expired') return u.is_expired || u.subscription_status === 'expired';
    if (userFilter === 'trial') return u.is_trial || u.subscription_type === 'trial_7d';
    if (userFilter === 'suspended') return u.subscription_status === 'suspended';

    return true;
  })

  // Mensagem de cobrança WhatsApp
  const getWhatsAppBillingLink = (user: any) => {
    const phone = (user.phone_number || '').replace(/\D/g, '')
    const expDate = user.subscription_expires_at 
      ? new Date(user.subscription_expires_at).toLocaleDateString('pt-BR') 
      : 'breve'
    const name = user.full_name || 'Cliente'
    const msg = encodeURIComponent(
      `Olá ${name}! Tudo bem?\n\nPassando para avisar que sua assinatura do sistema de links da Shopee vence em *${expDate}* (R$ 30,00/mês).\n\nPara renovar seu acesso por mais 30 dias com liberação automática via Pix, acesse o sistema ou solicite os dados aqui!\n\nObrigado pela parceria!`
    )
    return `https://wa.me/55${phone}?text=${msg}`
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full sm:w-[540px] h-11 bg-muted p-1">
          <TabsTrigger value="financeiro" className="gap-2 font-medium">
            <DollarSign className="w-4 h-4 text-green-500" />
            Financeiro (MRR)
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="gap-2 font-medium">
            <Users className="w-4 h-4 text-blue-500" />
            Usuários & Planos
          </TabsTrigger>
          <TabsTrigger value="integracoes" className="gap-2 font-medium">
            <Bot className="w-4 h-4 text-purple-500" />
            APIs & Telegram
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* ABA 1: DASHBOARD FINANCEIRO & MRR */}
        {/* ========================================================================= */}
        <TabsContent value="financeiro" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* MRR */}
            <Card className="border-l-4 border-l-green-500 bg-green-500/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-semibold">Receita Recorrente (MRR)</CardTitle>
                <DollarSign className="w-5 h-5 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-green-600 dark:text-green-400">
                  R$ {(stats?.mrr || 0).toFixed(2).replace('.', ',')}
                  <span className="text-xs font-normal text-muted-foreground ml-1">/mês</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Baseado em R$ 30,00/mês por cliente ativo
                </p>
              </CardContent>
            </Card>

            {/* Usuários Ativos */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-semibold">Clientes Ativos</CardTitle>
                <CheckCircle2 className="w-5 h-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-foreground">{stats?.activeUsers || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Assinaturas pagas em dia</p>
              </CardContent>
            </Card>

            {/* Usuários Vencidos */}
            <Card className="border-l-4 border-l-destructive bg-destructive/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-semibold">Clientes Vencidos</CardTitle>
                <XCircle className="w-5 h-5 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-destructive">{stats?.expiredUsers || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Assinaturas que requerem renovação</p>
              </CardContent>
            </Card>

            {/* Usuários em Teste 7 Dias */}
            <Card className="border-l-4 border-l-orange-500 bg-orange-500/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-semibold">Testes Grátis (7 Dias)</CardTitle>
                <Zap className="w-5 h-5 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-orange-600 dark:text-orange-400">
                  {stats?.trialUsers || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Novos clientes potenciais</p>
              </CardContent>
            </Card>
          </div>

          {/* Alerta de Vencimentos Próximos */}
          <Card className="border-orange-500/30">
            <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  Vencimentos nos Próximos 3 Dias ({stats?.expiringSoonList?.length || 0})
                </CardTitle>
                <CardDescription>
                  Envie um lembrete rápido via WhatsApp para garantir a renovação do cliente sem interrupções.
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { refetchStats(); refetchUsers(); }}
                className="gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Atualizar
              </Button>
            </CardHeader>
            <CardContent>
              {(!stats?.expiringSoonList || stats.expiringSoonList.length === 0) ? (
                <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg bg-muted/20">
                  🎉 Nenhum cliente com vencimento imediato nos próximos 3 dias.
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Data de Vencimento</TableHead>
                        <TableHead>Dias Restantes</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.expiringSoonList.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>{item.phone || <span className="text-muted-foreground italic text-xs">Sem telefone</span>}</TableCell>
                          <TableCell>
                            <span className="text-xs text-orange-600 dark:text-orange-400 font-semibold">
                              {format(new Date(item.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-orange-500 text-orange-600 text-xs">
                              {item.days_left === 1 ? 'Vence amanhã' : `Vence em ${item.days_left} dias`}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {item.phone ? (
                              <Button
                                asChild
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white gap-1.5 h-8 text-xs font-semibold"
                              >
                                <a
                                  href={`https://wa.me/55${item.phone.replace(/\D/g, '')}?text=Ol%C3%A1%20${encodeURIComponent(item.name)}!%20Sua%20assinatura%20vence%20em%20breve%20(R%24%2030%2C00).%20Gostaria%20de%20renovar%3F`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  Lembrete WhatsApp
                                </a>
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-8 text-xs"
                                onClick={() => {
                                  setSelectedUser(item)
                                  setIsRenewOpen(true)
                                }}
                              >
                                Renovar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 2: GESTÃO DE USUÁRIOS E MENSALIDADES */}
        {/* ========================================================================= */}
        <TabsContent value="usuarios" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-xl">Gestão de Clientes e Mensalidades</CardTitle>
                <CardDescription>
                  Crie novos clientes com teste de 7 dias ou mensalidade de R$ 30,00, renove acessos e controle o status.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    setCreatedUserCredentials(null)
                    setIsCreateUserOpen(true)
                  }}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 font-bold shadow-md shadow-primary/20"
                >
                  <UserPlus className="w-4 h-4" />
                  + Novo Usuário
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Filtros e Busca */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, e-mail ou telefone..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
                  <Button
                    size="sm"
                    variant={userFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setUserFilter('all')}
                    className="h-8 text-xs"
                  >
                    Todos ({users?.length || 0})
                  </Button>
                  <Button
                    size="sm"
                    variant={userFilter === 'active' ? 'default' : 'outline'}
                    onClick={() => setUserFilter('active')}
                    className="h-8 text-xs text-blue-600 dark:text-blue-400"
                  >
                    Ativos ({stats?.activeUsers || 0})
                  </Button>
                  <Button
                    size="sm"
                    variant={userFilter === 'expired' ? 'default' : 'outline'}
                    onClick={() => setUserFilter('expired')}
                    className="h-8 text-xs text-destructive"
                  >
                    Vencidos ({stats?.expiredUsers || 0})
                  </Button>
                  <Button
                    size="sm"
                    variant={userFilter === 'trial' ? 'default' : 'outline'}
                    onClick={() => setUserFilter('trial')}
                    className="h-8 text-xs text-orange-500"
                  >
                    Teste 7D ({stats?.trialUsers || 0})
                  </Button>
                </div>
              </div>

              {/* Tabela de Usuários */}
              {isLoadingUsers ? (
                <div className="space-y-2 py-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário / E-mail</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Plano & Valor</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Links / Cliques</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                            Nenhum usuário encontrado com os filtros selecionados.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUsers.map((user) => (
                          <TableRow key={user.id}>
                            {/* Nome & Email */}
                            <TableCell>
                              <div className="flex items-center gap-2.5">
                                <Avatar className="h-8 w-8 text-xs font-semibold">
                                  <AvatarFallback className="bg-primary/10 text-primary">
                                    {(user.full_name || user.email || 'U').substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                  <span className="font-semibold text-sm line-clamp-1">{user.full_name || 'Sem nome'}</span>
                                  <span className="text-xs text-muted-foreground line-clamp-1">{user.email}</span>
                                </div>
                              </div>
                            </TableCell>

                            {/* Telefone */}
                            <TableCell>
                              {user.phone_number ? (
                                <a
                                  href={getWhatsAppBillingLink(user)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-semibold hover:underline"
                                  title="Enviar mensagem no WhatsApp"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                  {user.phone_number}
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditUser(user)}
                                  className="text-xs text-primary/70 hover:text-primary hover:underline flex items-center gap-1"
                                >
                                  + Informar Telefone
                                </button>
                              )}
                            </TableCell>

                            {/* Plano & Valor */}
                            <TableCell>
                              <div className="flex flex-col gap-0.5">
                                <Badge variant="outline" className="w-fit text-[11px] font-semibold">
                                  {user.subscription_type === 'lifetime'
                                    ? '👑 Vitalício'
                                    : user.subscription_type === 'trial_7d'
                                    ? '⚡ Teste 7 Dias'
                                    : '💳 Mensal'}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {user.subscription_type === 'lifetime'
                                    ? 'Sem cobrança'
                                    : user.subscription_type === 'trial_7d'
                                    ? 'Grátis'
                                    : `R$ ${user.subscription_price.toFixed(2).replace('.', ',')}/mês`}
                                </span>
                              </div>
                            </TableCell>

                            {/* Vencimento */}
                            <TableCell>
                              {user.subscription_type === 'lifetime' || user.email?.toLowerCase() === 'ajpentretedimento@hotmail.com' ? (
                                <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30 text-xs font-semibold">
                                  👑 Vitalício (Admin)
                                </Badge>
                              ) : user.subscription_expires_at ? (
                                <div className="flex flex-col text-xs">
                                  <span className="font-semibold text-foreground">
                                    {format(new Date(user.subscription_expires_at), "dd/MM/yyyy", { locale: ptBR })}
                                  </span>
                                  <span className={`text-[11px] font-medium ${user.is_expired ? 'text-destructive' : 'text-muted-foreground'}`}>
                                    {user.is_expired 
                                      ? `Vencido há ${Math.abs(user.days_remaining)} dias` 
                                      : `${user.days_remaining} dias restantes`}
                                  </span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedUser(user)
                                    setRenewDays(30)
                                    setIsRenewOpen(true)
                                  }}
                                  className="text-xs text-orange-600 hover:underline flex items-center gap-1 font-medium"
                                >
                                  + Definir Vencimento
                                </button>
                              )}
                            </TableCell>

                            {/* Status */}
                            <TableCell>
                              <Badge
                                variant={
                                  user.subscription_status === 'active' && !user.is_expired
                                    ? 'default'
                                    : user.is_trial && !user.is_expired
                                    ? 'secondary'
                                    : 'destructive'
                                }
                                className="text-xs capitalize font-medium"
                              >
                                {user.is_expired ? '🔴 Vencido' : (user.is_trial ? '⚡ Em Teste' : '🟢 Ativo')}
                              </Badge>
                            </TableCell>

                            {/* Links e Cliques */}
                            <TableCell>
                              <div className="text-xs flex items-center gap-2 text-muted-foreground">
                                <span><b>{user.links_count}</b> links</span>
                                <span>•</span>
                                <span><b>{user.clicks_count}</b> cliques</span>
                              </div>
                            </TableCell>

                            {/* Ações */}
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuLabel>Ações do Usuário</DropdownMenuLabel>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedUser(user)
                                      setRenewDays(30)
                                      setIsRenewOpen(true)
                                    }}
                                    className="gap-2 text-green-600 dark:text-green-400 font-semibold cursor-pointer"
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                    Renovar (+30 dias)
                                  </DropdownMenuItem>

                                  {user.phone_number && (
                                    <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                                      <a href={getWhatsAppBillingLink(user)} target="_blank" rel="noreferrer">
                                        <MessageSquare className="w-4 h-4 text-green-500" />
                                        Cobrar no WhatsApp
                                      </a>
                                    </DropdownMenuItem>
                                  )}

                                  <DropdownMenuItem
                                    onClick={() => handleOpenEditUser(user)}
                                    className="gap-2 cursor-pointer"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                    Editar Usuário
                                  </DropdownMenuItem>

                                  <DropdownMenuSeparator />
                                  
                                  <DropdownMenuItem
                                    onClick={() => {
                                      if (confirm(`Tem certeza que deseja excluir o usuário ${user.email}? Todos os links e cliques serão apagados.`)) {
                                        deleteUserMutation.mutate(user.id)
                                      }
                                    }}
                                    className="gap-2 text-destructive cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Excluir Usuário
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 3: INTEGRAÇÕES & APIS (MERCADO PAGO + TELEGRAM BOT) */}
        {/* ========================================================================= */}
        <TabsContent value="integracoes" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Configuração Bot do Telegram */}
            <Card className="border-purple-500/30">
              <CardHeader>
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                  <Bot className="w-6 h-6" />
                  <CardTitle className="text-lg">Bot de Notificações Telegram</CardTitle>
                </div>
                <CardDescription>
                  Receba alertas em tempo real quando um novo cliente se cadastrar ou quando um pagamento Pix for aprovado no Mercado Pago.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="telegram_bot_token">Token do Bot (BotFather)</Label>
                  <Input
                    id="telegram_bot_token"
                    placeholder="Ex: 123456789:ABCdefGhIJKlmNoPQRstuv..."
                    value={settingsForm.telegram_bot_token}
                    onChange={(e) => setSettingsForm({ ...settingsForm, telegram_bot_token: e.target.value })}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Crie seu bot gratuitamente falando com o <b>@BotFather</b> no Telegram e cole o token aqui.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telegram_chat_id">Chat ID do Administrador</Label>
                  <Input
                    id="telegram_chat_id"
                    placeholder="Ex: 123456789 ou -100..."
                    value={settingsForm.telegram_chat_id}
                    onChange={(e) => setSettingsForm({ ...settingsForm, telegram_chat_id: e.target.value })}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Obtenha seu Chat ID enviando uma mensagem para o <b>@userinfobot</b> no Telegram.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleTestTelegram}
                    disabled={testingTelegram || !settingsForm.telegram_bot_token || !settingsForm.telegram_chat_id}
                    className="flex-1 gap-2"
                  >
                    {testingTelegram ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-purple-500" />}
                    Testar Notificação
                  </Button>

                  <Button
                    type="button"
                    onClick={() => saveSettingsMutation.mutate(settingsForm)}
                    disabled={saveSettingsMutation.isPending}
                    className="flex-1"
                  >
                    Salvar Telegram
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Configuração Mercado Pago */}
            <Card className="border-blue-500/30">
              <CardHeader>
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <CreditCard className="w-6 h-6" />
                  <CardTitle className="text-lg">API Mercado Pago (Cobrança Pix)</CardTitle>
                </div>
                <CardDescription>
                  Geração de QR Code Pix e liberação automática de +30 dias assim que o cliente pagar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mercadopago_access_token">Access Token de Produção</Label>
                  <Input
                    id="mercadopago_access_token"
                    type="password"
                    placeholder="APP_USR-..."
                    value={settingsForm.mercadopago_access_token}
                    onChange={(e) => setSettingsForm({ ...settingsForm, mercadopago_access_token: e.target.value })}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Pegue suas Credenciais de Produção em <b>mercadopago.com.br/developers</b>.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pix_key">Chave Pix Manual (Backup)</Label>
                  <Input
                    id="pix_key"
                    placeholder="Ex: ajpentretedimento@hotmail.com ou CNPJ"
                    value={settingsForm.pix_key}
                    onChange={(e) => setSettingsForm({ ...settingsForm, pix_key: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default_price">Valor Padrão da Mensalidade (R$)</Label>
                  <Input
                    id="default_price"
                    type="number"
                    step="0.01"
                    value={settingsForm.default_monthly_price}
                    onChange={(e) => setSettingsForm({ ...settingsForm, default_monthly_price: Number(e.target.value) })}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleTestMp}
                    disabled={testingMp || !settingsForm.mercadopago_access_token}
                    className="flex-1 gap-2"
                  >
                    {testingMp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4 text-blue-500" />}
                    Validar Token MP
                  </Button>

                  <Button
                    type="button"
                    onClick={() => saveSettingsMutation.mutate(settingsForm)}
                    disabled={saveSettingsMutation.isPending}
                    className="flex-1"
                  >
                    Salvar Mercado Pago
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ========================================================================= */}
      {/* MODAL: CRIAR NOVO USUÁRIO / CLIENTE */}
      {/* ========================================================================= */}
      <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Cadastrar Novo Cliente
            </DialogTitle>
            <DialogDescription>
              Escolha o tipo de acesso: Teste de 7 dias grátis ou Mensalista por R$ 30,00.
            </DialogDescription>
          </DialogHeader>

          {createdUserCredentials ? (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold text-base">
                  <CheckCircle2 className="w-5 h-5" />
                  Conta criada com sucesso!
                </div>
                <div className="space-y-1 text-sm bg-background p-3 rounded-lg border font-mono">
                  <p>👤 <b>Nome:</b> {createdUserCredentials.name}</p>
                  <p>📧 <b>E-mail:</b> {createdUserCredentials.email}</p>
                  <p>🔐 <b>Senha:</b> {createdUserCredentials.pass}</p>
                  <p>🌐 <b>Link de Acesso:</b> {window.location.origin}</p>
                </div>
              </div>

              <Button
                onClick={() => {
                  const text = `🎉 *SEU ACESSO AO LINKAFILIADO ESTÁ LIBERADO!*\n\nOlá ${createdUserCredentials.name}, sua conta foi criada:\n\n🌐 *Acesse:* ${window.location.origin}\n📧 *E-mail:* ${createdUserCredentials.email}\n🔐 *Senha:* ${createdUserCredentials.pass}\n\nBoas vendas!`
                  navigator.clipboard.writeText(text)
                  toast.success("Dados de acesso copiados para a área de transferência!")
                }}
                className="w-full gap-2 font-bold"
              >
                <Copy className="w-4 h-4" />
                Copiar Mensagem para o Cliente
              </Button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                createUserMutation.mutate(newUserForm)
              }}
              className="space-y-4 py-2"
            >
              {/* Seleção do Tipo de Plano */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNewUserForm({ ...newUserForm, plan_type: 'trial_7d', price: 0 })}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    newUserForm.plan_type === 'trial_7d'
                      ? 'border-orange-500 bg-orange-500/10 text-orange-600 font-bold ring-2 ring-orange-500/20'
                      : 'hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <span className="text-xs uppercase tracking-wider flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-orange-500" />
                    Teste Grátis
                  </span>
                  <span className="text-lg font-black text-foreground">7 Dias</span>
                  <span className="text-[11px] text-muted-foreground">Expiração automática</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNewUserForm({ ...newUserForm, plan_type: 'monthly', price: 30.00 })}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    newUserForm.plan_type === 'monthly'
                      ? 'border-primary bg-primary/10 text-primary font-bold ring-2 ring-primary/20'
                      : 'hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <span className="text-xs uppercase tracking-wider flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-primary" />
                    Mensalista
                  </span>
                  <span className="text-lg font-black text-foreground">R$ 30,00</span>
                  <span className="text-[11px] text-muted-foreground">Vencimento em 30 dias</span>
                </button>
              </div>

              {/* Dados Cadastrais */}
              <div className="space-y-2">
                <Label htmlFor="create_name">Nome Completo</Label>
                <Input
                  id="create_name"
                  placeholder="Ex: João da Silva"
                  value={newUserForm.full_name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, full_name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create_email">E-mail de Acesso</Label>
                <Input
                  id="create_email"
                  type="email"
                  placeholder="cliente@gmail.com"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="create_pass">Senha Inicial</Label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-xs text-primary hover:underline"
                  >
                    Gerar Aleatória
                  </button>
                </div>
                <Input
                  id="create_pass"
                  placeholder="Mínimo 6 caracteres"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create_phone">WhatsApp / Telefone (para cobrança)</Label>
                <Input
                  id="create_phone"
                  placeholder="Ex: 19981356505"
                  value={newUserForm.phone_number}
                  onChange={(e) => setNewUserForm({ ...newUserForm, phone_number: e.target.value })}
                />
              </div>

              <DialogFooter className="pt-3">
                <Button type="button" variant="outline" onClick={() => setIsCreateUserOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createUserMutation.isPending} className="font-bold">
                  {createUserMutation.isPending ? "Criando..." : "Criar Usuário"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: RENOVAÇÃO RÁPIDA DE ASSINATURA */}
      {/* ========================================================================= */}
      <Dialog open={isRenewOpen} onOpenChange={setIsRenewOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <RefreshCw className="w-5 h-5" />
              Renovar Assinatura
            </DialogTitle>
            <DialogDescription>
              Selecione o prazo de renovação para <b>{selectedUser?.full_name || selectedUser?.email}</b>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={renewDays === 7 ? 'default' : 'outline'}
                onClick={() => setRenewDays(7)}
                className="h-12 flex flex-col gap-0.5"
              >
                <span className="font-bold">+7 Dias</span>
                <span className="text-[10px] opacity-80">Extensão</span>
              </Button>

              <Button
                type="button"
                variant={renewDays === 30 ? 'default' : 'outline'}
                onClick={() => setRenewDays(30)}
                className="h-12 flex flex-col gap-0.5"
              >
                <span className="font-bold">+30 Dias</span>
                <span className="text-[10px] opacity-80">R$ 30,00</span>
              </Button>

              <Button
                type="button"
                variant={renewDays === 365 ? 'default' : 'outline'}
                onClick={() => setRenewDays(365)}
                className="h-12 flex flex-col gap-0.5"
              >
                <span className="font-bold">+1 Ano</span>
                <span className="text-[10px] opacity-80">Anual</span>
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenewOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedUser) {
                  renewMutation.mutate({
                    userId: selectedUser.id,
                    daysToAdd: renewDays,
                    price: 30.00,
                    planType: 'monthly',
                  })
                }
              }}
              disabled={renewMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white font-bold"
            >
              {renewMutation.isPending ? "Renovando..." : `Confirmar +${renewDays} dias`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: EDITAR USUÁRIO (TOTALMENTE CONTROLADO VIA REACT STATE) */}
      {/* ========================================================================= */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Altere dados, plano, telefone ou redefina a senha de <b>{selectedUser?.email}</b>.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const expIso = editForm.subscription_expires_at 
                  ? new Date(editForm.subscription_expires_at + 'T23:59:59').toISOString() 
                  : undefined

                updateUserMutation.mutate({
                  userId: editForm.userId,
                  full_name: editForm.full_name,
                  phone_number: editForm.phone_number,
                  subscription_status: editForm.subscription_status,
                  subscription_type: editForm.subscription_type,
                  subscription_price: Number(editForm.subscription_price) || 30.00,
                  subscription_expires_at: expIso,
                  new_password: editForm.new_password ? editForm.new_password : undefined,
                })
              }}
              className="space-y-4 py-2"
            >
              <div className="space-y-2">
                <Label htmlFor="edit_name">Nome</Label>
                <Input 
                  id="edit_name" 
                  value={editForm.full_name} 
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} 
                  required 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_phone">WhatsApp / Telefone</Label>
                <Input 
                  id="edit_phone" 
                  value={editForm.phone_number} 
                  onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })} 
                  placeholder="Ex: 19981356505"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit_status">Status</Label>
                  <Select 
                    value={editForm.subscription_status} 
                    onValueChange={(val: any) => setEditForm({ ...editForm, subscription_status: val })}
                  >
                    <SelectTrigger id="edit_status">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">🟢 Ativo</SelectItem>
                      <SelectItem value="trial">⚡ Em Teste</SelectItem>
                      <SelectItem value="expired">🔴 Vencido</SelectItem>
                      <SelectItem value="suspended">⚪ Suspenso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_price">Mensalidade (R$)</Label>
                  <Input 
                    id="edit_price" 
                    type="number" 
                    step="0.01" 
                    value={editForm.subscription_price} 
                    onChange={(e) => setEditForm({ ...editForm, subscription_price: Number(e.target.value) })} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit_type">Tipo de Plano</Label>
                  <Select 
                    value={editForm.subscription_type} 
                    onValueChange={(val: string) => setEditForm({ ...editForm, subscription_type: val })}
                  >
                    <SelectTrigger id="edit_type">
                      <SelectValue placeholder="Selecione o plano" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial_7d">⚡ Teste 7 Dias</SelectItem>
                      <SelectItem value="monthly">💳 Mensal</SelectItem>
                      <SelectItem value="quarterly">📅 Trimestral</SelectItem>
                      <SelectItem value="yearly">👑 Anual</SelectItem>
                      <SelectItem value="lifetime">♾️ Vitalício</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_expires_at">Data de Vencimento</Label>
                  <Input 
                    id="edit_expires_at" 
                    type="date" 
                    value={editForm.subscription_expires_at} 
                    onChange={(e) => setEditForm({ ...editForm, subscription_expires_at: e.target.value })} 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_password">Redefinir Senha (opcional)</Label>
                <Input 
                  id="edit_password" 
                  placeholder="Preencha apenas se quiser trocar" 
                  value={editForm.new_password} 
                  onChange={(e) => setEditForm({ ...editForm, new_password: e.target.value })} 
                />
              </div>

              <DialogFooter className="pt-3">
                <Button type="button" variant="outline" onClick={() => setIsEditUserOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateUserMutation.isPending} className="font-bold">
                  {updateUserMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}