import { createFileRoute } from '@tanstack/react-router'
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

import { Trash2, Phone, Upload, CheckCircle2, AlertCircle, X, Search, Settings2, Key, Loader2, Pause, Play, Ban, AlertTriangle, Clock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"


export const Route = createFileRoute('/_authenticated/contacts')({
  component: ContactsPage,
})


type QueueStatus = 'pending' | 'processing' | 'completed' | 'waiting' | 'error' | 'ignored';

interface QueueItem {
  id: string;
  file: File;
  status: QueueStatus;
  error?: string;
}

function ContactsPage() {
  const [files, setFiles] = useState<File[]>([])
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [processing, setProcessing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [summary, setSummary] = useState<{ processed: number; new: number; duplicates: number; review: number } | null>(null)
  
  // Controle de Rate Limit (429)
  const [isWaiting, setIsWaiting] = useState(false)
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
    countsRef.current = { new: 0, dup: 0, rev: 0, processed: 0 }
  }

  // Timer para o contador regressivo de espera (429)
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isWaiting && waitTime > 0) {
      timer = setInterval(() => {
        setWaitTime(prev => {
          if (prev <= 1) {
            if (timer) clearInterval(timer);
            setIsWaiting(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isWaiting, waitTime]);

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
      toast.error("Processamento cancelado");
    }
  }


  const processImages = async () => {
    if (processing) return;
    
    setProcessing(true);
    processingRef.current = true;
    pausedRef.current = false;
    cancelRef.current = false;
    setIsPaused(false);
    setProgress(0);
    
    countsRef.current = { new: 0, dup: 0, rev: 0, processed: 0 };
    const batchPhones = new Set<string>();
    
    // Filtra apenas itens pendentes ou com erro para processar/re-processar
    const itemsToProcess = queue.filter(item => item.status === 'pending' || item.status === 'error');
    
    // Lotes de 5
    const batchSize = 5;
    const totalItems = itemsToProcess.length;
    
    for (let i = 0; i < totalItems; i += batchSize) {
      if (cancelRef.current) break;
      
      // Verifica pausa antes de cada lote
      while (pausedRef.current && !cancelRef.current) {
        await new Promise(r => setTimeout(r, 1000));
      }
      
      const currentBatch = itemsToProcess.slice(i, i + batchSize);
      
      // Atualiza status para 'processing'
      setQueue(prev => prev.map(item => 
        currentBatch.find(b => b.id === item.id) 
          ? { ...item, status: 'processing' } 
          : item
      ));

      // Processa o lote em paralelo (máximo 5)
      const batchPromises = currentBatch.map(async (item) => {
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(item.file);
          });
          
          const base64Data = base64.split(',')[1] || base64;
          
          // Função de chamada com retry automático para 429
          const callGeminiWithRetry = async (retryCount = 0): Promise<any> => {
            try {
              return await extractContactFromGemini(base64Data, item.file.type || 'image/jpeg');
            } catch (err: any) {
              if (err.status === 429 && retryCount < 3) {
                const wait = err.retryAfter || (60 * (retryCount + 1));
                console.warn(`[429] Limite atingido. Aguardando ${wait}s...`);
                
                setIsWaiting(true);
                setWaitTime(wait);
                
                // Aguarda o tempo informado
                await new Promise(r => setTimeout(r, wait * 1000));
                
                return callGeminiWithRetry(retryCount + 1);
              }
              throw err;
            }
          };

          const extractedContacts = await callGeminiWithRetry();
          
          if (!extractedContacts || extractedContacts.length === 0) {
            countsRef.current.rev++;
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: 'Nenhum contato identificado' } : q));
            return;
          }

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
              if (err.message === 'DUPLICATE_CONTACT') {
                countsRef.current.dup++;
              } else {
                countsRef.current.rev++;
                throw err;
              }
            }
          }
          
          countsRef.current.processed++;
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'completed' } : q));
          
        } catch (err: any) {
          console.error(`Erro ao processar ${item.file.name}:`, err);
          countsRef.current.rev++;
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: err.message } : q));
        }
      });

      await Promise.all(batchPromises);
      
      // Atualiza progresso global
      const processedSoFar = Math.min(i + batchSize, totalItems);
      setProgress((processedSoFar / totalItems) * 100);
      
      // Pequena pausa entre lotes para não sobrecarregar
      await new Promise(r => setTimeout(r, 1000));
    }

    setSummary({ 
      processed: countsRef.current.processed, 
      new: countsRef.current.new, 
      duplicates: countsRef.current.dup, 
      review: countsRef.current.rev 
    });
    
    setProcessing(false);
    processingRef.current = false;
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
    toast.success("Processamento de fila concluído");
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
          <Card className="border-primary/20 bg-primary/5 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Upload de Imagens
              </CardTitle>
              <CardDescription>Envie prints de pedidos ou etiquetas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer hover:bg-background/50 ${
                  isDragActive ? 'border-primary bg-primary/10' : 'border-muted'
                }`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-2">
                  <Upload className={`h-8 w-8 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  <p className="text-sm font-medium">Arraste ou clique para selecionar</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, WEBP (Máx. 5MB por arquivo)</p>
                </div>
              </div>
              
              {summary && (
                <div className="p-4 bg-background/80 rounded-xl border border-primary/10 space-y-3 animate-in zoom-in-95 duration-300">
                  <div className="flex items-center gap-2 text-sm font-bold border-b pb-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Resumo do Processamento
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex flex-col bg-muted/30 p-2 rounded border border-muted">
                      <span className="text-muted-foreground uppercase text-[9px] font-bold">Total Processado</span>
                      <span className="text-lg font-bold">{summary.processed}</span>
                    </div>
                    <div className="flex flex-col bg-green-500/10 p-2 rounded border border-green-200/50">
                      <span className="text-green-600 uppercase text-[9px] font-bold">Novos Contatos</span>
                      <span className="text-lg font-bold text-green-700">{summary.new}</span>
                    </div>
                    <div className="flex flex-col bg-yellow-500/10 p-2 rounded border border-yellow-200/50">
                      <span className="text-yellow-600 uppercase text-[9px] font-bold">Duplicados</span>
                      <span className="text-lg font-bold text-yellow-700">{summary.duplicates}</span>
                    </div>
                    <div className="flex flex-col bg-red-500/10 p-2 rounded border border-red-200/50">
                      <span className="text-red-600 uppercase text-[9px] font-bold">Para Revisar</span>
                      <span className="text-lg font-bold text-red-700">{summary.review}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>


          <Card className="border-primary/20 bg-primary/5 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Fila de Processamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              
              {isWaiting && (
                <Alert variant="destructive" className="bg-yellow-50 border-yellow-200 text-yellow-800 animate-pulse">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <AlertTitle className="text-yellow-800 flex items-center gap-2">
                    Limite da API atingido
                  </AlertTitle>
                  <AlertDescription className="text-yellow-700 font-medium">
                    Aguardando {waitTime} segundos para continuar automaticamente...
                  </AlertDescription>
                </Alert>
              )}

              {queue.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{queue.length} arquivos na fila</span>
                    <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                      Limpar Tudo
                    </Button>
                  </div>
                  
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-2 border rounded-lg p-2 bg-muted/20">
                    {queue.map((item, idx) => (
                      <div key={item.id} className={cn(
                        "flex items-center justify-between text-[11px] p-2 rounded border transition-colors bg-background",
                        item.status === 'processing' && "border-primary bg-primary/5",
                        item.status === 'completed' && "border-green-200 bg-green-50/30",
                        item.status === 'error' && "border-red-200 bg-red-50/30"
                      )}>
                        <div className="flex items-center gap-2 truncate flex-1">
                          {item.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                          {item.status === 'completed' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                          {item.status === 'error' && <AlertTriangle className="h-3 w-3 text-red-500" />}
                          {item.status === 'pending' && <Clock className="h-3 w-3 text-muted-foreground" />}
                          <span className="truncate">{item.file.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {item.status === 'error' && (
                            <span className="text-[9px] text-red-500 font-medium italic truncate max-w-[80px]">
                              {item.error}
                            </span>
                          )}
                          {!processing && (
                            <Button variant="ghost" size="icon" onClick={() => removeFile(idx)} className="h-5 w-5 text-muted-foreground hover:text-destructive">
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {processing ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        variant="outline" 
                        className="w-full gap-2 border-primary/20" 
                        onClick={togglePause}
                      >
                        {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                        {isPaused ? 'Continuar' : 'Pausar'}
                      </Button>
                      <Button 
                        variant="destructive" 
                        className="w-full gap-2" 
                        onClick={cancelProcessing}
                      >
                        <Ban className="h-4 w-4" />
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      className="w-full font-bold shadow-sm" 
                      onClick={processImages} 
                      disabled={queue.length === 0 || queue.every(q => q.status === 'completed')}
                    >
                      {queue.some(q => q.status === 'error') ? 'Tentar Erros Novamente' : 'Iniciar Processamento'}
                    </Button>
                  )}
                </div>
              )}

              {processing && (
                <div className="space-y-2 p-3 bg-primary/5 rounded-xl border border-primary/10">
                  <div className="flex justify-between text-[10px] font-medium mb-1">
                    <span>Progresso Geral</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="flex justify-between items-center text-[9px] text-muted-foreground mt-2">
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      Lote em andamento...
                    </span>
                    <span>{queue.filter(q => q.status === 'completed').length} / {queue.length} concluídos</span>
                  </div>
                </div>
              )}

              {summary && (
                <div className="p-4 bg-background/80 rounded-xl border border-primary/10 space-y-3 animate-in zoom-in-95 duration-300">
                  <div className="flex items-center gap-2 text-sm font-bold border-b pb-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Resumo do Processamento
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex flex-col bg-muted/30 p-2 rounded border border-muted">
                      <span className="text-muted-foreground uppercase text-[9px] font-bold">Total Processado</span>
                      <span className="text-lg font-bold">{summary.processed}</span>
                    </div>
                    <div className="flex flex-col bg-green-500/10 p-2 rounded border border-green-200/50">
                      <span className="text-green-600 uppercase text-[9px] font-bold">Novos Contatos</span>
                      <span className="text-lg font-bold text-green-700">{summary.new}</span>
                    </div>
                    <div className="flex flex-col bg-yellow-500/10 p-2 rounded border border-yellow-200/50">
                      <span className="text-yellow-600 uppercase text-[9px] font-bold">Duplicados</span>
                      <span className="text-lg font-bold text-yellow-700">{summary.duplicates}</span>
                    </div>
                    <div className="flex flex-col bg-red-500/10 p-2 rounded border border-red-200/50">
                      <span className="text-red-600 uppercase text-[9px] font-bold">Para Revisar</span>
                      <span className="text-lg font-bold text-red-700">{summary.review}</span>
                    </div>
                  </div>
                  {summary.review > 0 && (
                    <p className="text-[10px] text-muted-foreground italic bg-muted/20 p-2 rounded leading-tight">
                      * Algumas imagens não tinham dados legíveis e foram marcadas para revisão manual.
                    </p>
                  )}
                </div>
              )}



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
                              if (confirm('Excluir este contato?')) {
                                try {
                                  const { error } = await supabase.from('contacts').delete().eq('id', contact.id);
                                  if (error) {
                                    console.error('[DELETE_ERROR] Falha ao excluir contato:', error);
                                    toast.error(`Erro ao excluir: ${error.message}`);
                                  } else {
                                    toast.success('Contato excluído');
                                    queryClient.invalidateQueries({ queryKey: ['contacts'] });
                                  }
                                } catch (err: any) {
                                  console.error('[DELETE_CRASH] Erro inesperado ao excluir:', err);
                                  toast.error('Erro inesperado ao excluir contato');
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
