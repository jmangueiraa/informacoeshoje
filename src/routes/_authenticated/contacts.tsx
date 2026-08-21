import { createFileRoute, redirect } from '@tanstack/react-router'
import { CONTACTS_BLOCKED_EMAILS } from '@/lib/constants'
import { useState, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { getContacts, saveContact, updateLastSend } from '@/lib/contacts.functions'
import { extractContactFromGemini } from '@/lib/gemini'
import { formatPhone, cn } from '@/lib/utils'
import { differenceInDays, addDays, parseISO, format } from 'date-fns'

import { Trash2, Phone, Upload, CheckCircle2, AlertCircle, X, Search, Settings2, Key, Loader2, Pause, Play, Ban, AlertTriangle, Clock, FileSpreadsheet } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { importContactsFromExcel } from '@/lib/excel-import.functions'


export const Route = createFileRoute('/_authenticated/contacts')({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const email = (session?.user?.email || '').toLowerCase()
    if (CONTACTS_BLOCKED_EMAILS.includes(email)) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: ContactsPage,
})


type QueueStatus = 'pending' | 'processing' | 'completed' | 'waiting' | 'error' | 'ignored' | 'waiting_limit' | 'final_error' | 'cancelled';

interface QueueItem {
  id: string;
  file: File;
  status: QueueStatus;
  error?: string;
  retryCount?: number;
}

function ContactsPage() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [processing, setProcessing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [summary, setSummary] = useState<{ processed: number; new: number; duplicates: number; review: number } | null>(null)
  
  // Controle de Rate Limit (429)
  const [isWaiting, setIsWaiting] = useState(false)
  const [isApiReleased, setIsApiReleased] = useState(false)
  const [waitTime, setWaitTime] = useState(0)
  const waitTimerRef = useRef<NodeJS.Timeout | null>(null)
  const processingRef = useRef(false)
  const pausedRef = useRef(false)
  const cancelRef = useRef(false)

  // Referências para contadores (evitar problemas de closure em loops longos)
  const countsRef = useRef({ new: 0, dup: 0, rev: 0, processed: 0 })

  
  
  // Estado para a chave da API do Gemini
  const [geminiKey, setGeminiKey] = useState('')
  const [isKeyDialogOpen, setIsKeyDialogOpen] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('GEMINI_API_KEY_LOCAL')
    if (stored) setGeminiKey(stored)
  }, [])

  const saveGeminiKey = () => {
    if (geminiKey.trim()) {
      localStorage.setItem('GEMINI_API_KEY_LOCAL', geminiKey.trim())
      toast.success('Chave de API salva localmente!')
    } else {
      localStorage.removeItem('GEMINI_API_KEY_LOCAL')
      toast.info('Chave removida. Usando padrão do sistema.')
    }
    setIsKeyDialogOpen(false)
  }
  
  const queryClient = useQueryClient()
  const { data: contacts, isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => getContacts(),
  })

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      // Adiciona novos arquivos à fila
      const newItems = acceptedFiles.map(file => ({
        id: Math.random().toString(36).substring(7) + '-' + Date.now(),
        file,
        status: 'pending' as QueueStatus
      }));
      setQueue(prev => [...prev, ...newItems]);
    },
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] }
  })

  const removeFile = (index: number) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
  }

  const clearAll = () => {
    if (processing) {
      if (!confirm("O processamento está em curso. Deseja cancelar tudo?")) return;
      cancelRef.current = true;
    }
    setQueue([])
    setSummary(null)
    setProgress(0)
    setProcessing(false)
    setIsPaused(false)
    setIsWaiting(false)
    setIsApiReleased(false)
    countsRef.current = { new: 0, dup: 0, rev: 0, processed: 0 }
  }

  // Timer para o contador regressivo de espera (429)
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isWaiting && waitTime > 0 && !isPaused) {
      timer = setInterval(() => {
        setWaitTime(prev => {
          if (prev <= 1) {
            if (timer) clearInterval(timer);
            // Ao chegar a zero, não limpamos isWaiting imediatamente
            // Mudamos para o estado de "verificando disponibilidade"
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isWaiting, waitTime, isPaused]);

  const togglePause = () => {
    const newPaused = !isPaused;
    setIsPaused(newPaused);
    pausedRef.current = newPaused;
    if (!newPaused) {
      toast.info("Processamento retomado");
    } else {
      toast.info("Processamento pausado após o lote atual");
    }
  }

  const cancelProcessing = () => {
    if (confirm("Deseja realmente cancelar o processamento restante?")) {
      cancelRef.current = true;
      setProcessing(false);
      setQueue(prev => prev.map(q => 
        (q.status === 'pending' || q.status === 'processing' || q.status === 'waiting_limit') 
          ? { ...q, status: 'cancelled' } 
          : q
      ));
      toast.error("Processamento cancelado");
    }
  }


  const processImages = async () => {
    // Trava dura: impede qualquer execução concorrente do worker
    if (processingRef.current) return;
    processingRef.current = true;

    setProcessing(true);
    pausedRef.current = false;
    cancelRef.current = false;
    setIsPaused(false);
    setProgress(0);

    countsRef.current = { new: 0, dup: 0, rev: 0, processed: 0 };
    const batchPhones = new Set<string>();

    // Snapshot local da fila (evita closure obsoleta sobre `queue`,
    // que fazia o mesmo arquivo ser reenviado indefinidamente).
    const items = queue.filter(item =>
      item.status === 'pending' ||
      item.status === 'waiting_limit' ||
      item.status === 'error' ||
      item.status === 'cancelled'
    );
    const totalItems = items.length;

    // Cada id só pode ser enviado uma vez com sucesso/erro final
    const finishedIds = new Set<string>();
    let doneCount = 0;

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const waitWhilePaused = async () => {
      while (pausedRef.current && !cancelRef.current) await sleep(300);
    };

    try {
      for (const item of items) {
        if (cancelRef.current) break;
        if (finishedIds.has(item.id)) continue;

        await waitWhilePaused();
        if (cancelRef.current) break;

        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing' } : q));

        // No máximo 1 nova tentativa por 429 para o MESMO arquivo
        let attempt = 0;
        let settled = false;

        while (!settled && attempt < 2 && !cancelRef.current) {
          attempt++;
          try {
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(item.file);
            });
            const base64Data = base64.split(',')[1] || base64;

            const extractedContacts = await extractContactFromGemini(base64Data, item.file.type || 'image/jpeg');

            setIsWaiting(false);
            setWaitTime(0);

            if (!extractedContacts || extractedContacts.length === 0) {
              countsRef.current.rev++;
              setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'final_error', error: 'Nenhum contato identificado' } : q));
            } else {
              for (const contactData of extractedContacts) {
                const phoneDigits = contactData.phone ? String(contactData.phone).replace(/\D/g, '') : '';
                if (phoneDigits && batchPhones.has(phoneDigits)) {
                  countsRef.current.dup++;
                  continue;
                }
                if (phoneDigits) batchPhones.add(phoneDigits);

                try {
                  const savedContact = await saveContact({
                    data: {
                      name: contactData.name || 'Cliente',
                      phone: contactData.phone,
                      needsReview: !contactData.name || !contactData.phone,
                      reviewReason: (!contactData.name || !contactData.phone) ? 'Dados incompletos' : null,
                      rawData: contactData || null
                    }
                  });
                  if (savedContact.needs_review) countsRef.current.rev++;
                  else countsRef.current.new++;
                } catch (err: any) {
                  if (err.message === 'DUPLICATE_CONTACT') countsRef.current.dup++;
                  else countsRef.current.rev++;
                }
              }
              countsRef.current.processed++;
              setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'completed' } : q));
            }
            settled = true;
          } catch (err: any) {
            if (err?.status === 429 && attempt < 2) {
              const wait = err.retryAfter || 60;
              setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'waiting_limit' } : q));
              setIsApiReleased(false);
              setWaitTime(wait);
              setIsWaiting(true);

              // Aguarda o backoff antes da única nova tentativa real
              for (let s = 0; s < wait && !cancelRef.current; s++) {
                await waitWhilePaused();
                await sleep(1000);
              }
              setIsWaiting(false);
              setWaitTime(0);
              setIsApiReleased(true);
              setTimeout(() => setIsApiReleased(false), 3000);
              setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing' } : q));
              continue;
            }

            console.error(`Erro no item ${item.id}:`, err);
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'final_error', error: err?.message || 'Falha na extração' } : q));
            countsRef.current.rev++;
            settled = true;
          }
        }

        finishedIds.add(item.id);
        doneCount++;
        setProgress(totalItems > 0 ? Math.round((doneCount / totalItems) * 100) : 100);

        // Respeita a cota (~5 req/min) somente se ainda houver itens
        if (!cancelRef.current && doneCount < totalItems) {
          await sleep(12000);
        }
      }
    } finally {
      setSummary({
        processed: countsRef.current.processed,
        new: countsRef.current.new,
        duplicates: countsRef.current.dup,
        review: countsRef.current.rev
      });

      setProgress(100);
      setProcessing(false);
      setIsWaiting(false);
      setWaitTime(0);
      processingRef.current = false;
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      if (!cancelRef.current) toast.success("Processamento concluído");
    }
  }



  const filteredContacts = contacts?.filter((c: any) => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone_normalized.includes(searchTerm)
  )

  const updateLastSendMutation = useMutation({
    mutationFn: (contactId: string) => updateLastSend({ data: { contactId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      toast.success('Status de envio atualizado!')
    },
    onError: (error) => {
      toast.error('Erro ao atualizar status: ' + error.message)
    }
  })

  const calculateDaysUntilNextSend = (contact: any) => {
    const baseDate = contact.last_send ? parseISO(contact.last_send) : parseISO(contact.created_at)
    const nextSendDate = addDays(baseDate, 7)
    const today = new Date()
    const diff = differenceInDays(nextSendDate, today)
    return Math.max(0, diff)
  }

  const handleSendMessage = (contact: any) => {
    // Primeiro abre o WhatsApp
    window.open(`https://wa.me/55${contact.phone_normalized}`, '_blank')
    // Depois atualiza a data no banco
    updateLastSendMutation.mutate(contact.id)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Captura de Contatos</h1>
          <p className="text-muted-foreground">Extraia automaticamente nomes e telefones de imagens de logística (Shopee).</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isKeyDialogOpen} onOpenChange={setIsKeyDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10">
                <Settings2 className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" />
                  Configuração de API Gemini
                </DialogTitle>
                <DialogDescription>
                  Insira sua própria chave de API do Google Gemini se desejar. Ela será salva apenas no seu navegador (localStorage).
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="api-key">Chave de API</Label>
                  <Input 
                    id="api-key" 
                    type="password" 
                    value={geminiKey} 
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="Cole sua chave AQ.Ab8RN..."
                  />
                  <p className="text-[10px] text-muted-foreground italic">
                    Se deixar vazio, o sistema usará a chave padrão configurada.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={saveGeminiKey}>Salvar Configurações</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-green-500/20 bg-green-50/5 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                Upload Excel / CSV
              </CardTitle>
              <CardDescription>Importe contatos em massa rapidamente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div 
                className="border-2 border-dashed border-green-200 rounded-xl p-8 text-center transition-all cursor-pointer hover:bg-green-50/50"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.xlsx, .xls, .csv';
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (!file) return;

                    toast.loading("Processando arquivo...");
                    
                    try {
                      let contacts: { name: string; phone: string }[] = [];
                      
                      if (file.name.endsWith('.csv')) {
                        const text = await file.text();
                        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
                        contacts = (result.data as any[]).map(row => ({
                          name: String(row.nome || row.name || row.Nome || row.Name || Object.values(row)[0] || ""),
                          phone: String(row.telefone || row.phone || row.Telefone || row.Phone || Object.values(row)[1] || "")
                        }));
                      } else {
                        const data = await file.arrayBuffer();
                        const workbook = XLSX.read(data);
                        const firstSheetName = workbook.SheetNames[0];
                        if (!firstSheetName) throw new Error("Arquivo Excel vazio");
                        const worksheet = workbook.Sheets[firstSheetName];
                        if (!worksheet) throw new Error("Planilha não encontrada");
                        const json = XLSX.utils.sheet_to_json(worksheet);
                        contacts = json.map((row: any) => ({
                          name: String(row.nome || row.name || row.Nome || row.Name || Object.values(row)[0] || ""),
                          phone: String(row.telefone || row.phone || row.Telefone || row.Phone || Object.values(row)[1] || "")
                        }));
                      }

                      contacts = contacts.filter(c => c.name && c.phone);

                      if (contacts.length === 0) {
                        toast.dismiss();
                        toast.error("Nenhum contato válido encontrado no arquivo.");
                        return;
                      }

                      const result = await importContactsFromExcel({ data: { contacts } });
                      toast.dismiss();
                      toast.success(`Importação concluída: ${result.imported} salvos, ${result.duplicates} duplicados.`);
                      queryClient.invalidateQueries({ queryKey: ['contacts'] });
                    } catch (err) {
                      toast.dismiss();
                      toast.error("Erro ao processar arquivo Excel/CSV.");
                    }
                  };
                  input.click();
                }}
              >
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet className="h-8 w-8 text-green-600" />
                  <p className="text-sm font-medium">Clique para selecionar Excel/CSV</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Colunas esperadas: Nome, Telefone</p>
                </div>
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                className="w-full gap-2 text-xs"
                onClick={() => {
                  const ws = XLSX.utils.aoa_to_sheet([
                    ["Nome", "Telefone"],
                    ["Exemplo Cliente", "19981356505"]
                  ]);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "Modelo");
                  XLSX.writeFile(wb, "modelo_importacao_contatos.xlsx");
                }}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Baixar Modelo de Planilha
              </Button>
            </CardContent>
          </Card>

        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Base de Contatos</CardTitle>
                  <CardDescription>Visualize e gerencie seus leads extraídos</CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar nome ou telefone..." 
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[140px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array(5).fill(0).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                          <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                          <TableCell><div className="h-8 w-full bg-muted animate-pulse rounded" /></TableCell>
                          <TableCell><div className="h-8 w-full bg-muted animate-pulse rounded" /></TableCell>
                        </TableRow>
                      ))
                    ) : filteredContacts?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                          {searchTerm ? 'Nenhum contato encontrado para esta busca.' : 'Nenhum contato capturado ainda.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredContacts?.map((contact: any) => (
                    <TableRow 
                      key={contact.id} 
                      className={cn(
                        "group hover:bg-muted/30 transition-colors",
                        calculateDaysUntilNextSend(contact) === 0 && "bg-red-50/50 hover:bg-red-100/50"
                      )}
                    >
                      <TableCell className="font-medium">
                        {contact.name}
                        {contact.needs_review && (
                          <p className="text-[10px] text-red-500 font-normal mt-0.5">
                            Motivo: {contact.review_reason || 'Revisão manual necessária'}
                          </p>
                        )}
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          ID: {contact.id.substring(0, 8)} | Criado em: {format(parseISO(contact.created_at), 'dd/MM/yy')}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-1 rounded bg-primary/10 text-primary text-xs font-mono">
                          {formatPhone(contact.phone_normalized)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {contact.needs_review ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 w-fit">
                              <AlertCircle className="h-3 w-3" />
                              Revisar
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100 w-fit">
                              <CheckCircle2 className="h-3 w-3" />
                              OK
                            </span>
                          )}
                          
                          {(() => {
                            const daysLeft = calculateDaysUntilNextSend(contact)
                            return daysLeft === 0 ? (
                              <span className="text-[10px] font-bold text-red-600 animate-pulse">
                                Envio Pendente
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">
                                Faltam {daysLeft} dias para o envio
                              </span>
                            )
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {calculateDaysUntilNextSend(contact) === 0 ? (
                            <Button 
                              variant="default" 
                              size="sm" 
                              className="h-8 gap-2 bg-red-600 hover:bg-red-700 text-white transition-all shadow-sm"
                              onClick={() => handleSendMessage(contact)}
                            >
                              <Phone className="h-3.5 w-3.5" />
                              Enviar Mensagem
                            </Button>
                          ) : (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 gap-2 hover:bg-green-500 hover:text-white transition-all"
                              onClick={() => handleSendMessage(contact)}
                            >
                              <Phone className="h-3.5 w-3.5" />
                              WhatsApp
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={async () => {
                              if (confirm('U+2063 este contato?')) {
                                try {
                                  const { error } = await supabase.from('contacts').delete().eq('id', contact.id);
                                  if (error) {
                                    console.error('[DELETE_ERROR] Falha ao U+2063 contato:', error);
                                    toast.error(`Erro ao U+2063: ${error.message}`);
                                  } else {
                                    toast.success('Contato U+2063');
                                    queryClient.invalidateQueries({ queryKey: ['contacts'] });
                                  }
                                } catch (err: any) {
                                  console.error('[DELETE_CRASH] Erro inesperado ao U+2063:', err);
                                  toast.error('Erro inesperado ao U+2063 contato');
                                }
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
