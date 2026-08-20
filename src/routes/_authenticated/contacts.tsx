import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getContacts, saveContact, runControlledTest } from '@/lib/contacts.functions'
import { extractContactFromGemini } from '@/lib/gemini'
import { formatPhone } from '@/lib/utils'

import { Trash2, Phone, Upload, CheckCircle2, AlertCircle, X, Search, Beaker, Settings2, Key } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/contacts')({
  beforeLoad: async ({ context }) => {
    // @ts-ignore
    const userId = context.userId;
    
    // Verificação de admin rápida
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin'
    });

    if (!isAdmin) {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: ContactsPage,
})


function ContactsPage() {
  const [files, setFiles] = useState<File[]>([])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [summary, setSummary] = useState<{ processed: number; new: number; duplicates: number; review: number } | null>(null)
  const [debugData, setDebugData] = useState<any>(null)
  const [testResults, setTestResults] = useState<any[] | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  
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
      setFiles((prev) => [...prev, ...acceptedFiles])
    },
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] }
  })

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  const clearAll = () => {
    setFiles([])
    setSummary(null)
    setProgress(0)
  }

  const processImages = async () => {
    setProcessing(true)
    setProgress(0)
    let newCount = 0
    let dupCount = 0
    let revCount = 0
    
    // Conjunto para rastrear duplicatas dentro do mesmo lote (batch)
    const batchPhones = new Set<string>();

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file) continue

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      try {
        console.log(`[IMPORT] Iniciando extração do arquivo: ${file.name} (tipo: ${file.type}, tamanho: ${file.size})`);
        
        const base64Data = base64.split(',')[1] || base64;
        
        // Chamada direta ao Gemini no frontend
        const extractedContacts = await extractContactFromGemini(base64Data, file.type || 'image/jpeg');
        
        console.log(`[IMPORT] Contatos extraídos via Gemini Frontend para ${file.name}:`, extractedContacts);


        if (extractedContacts.length === 0) {
          revCount++;
          toast.error(`Nenhum contato identificado em ${file.name}`);
          continue;
        }

        for (const contactData of extractedContacts) {
          const phoneDigits = contactData.phone ? String(contactData.phone).replace(/\D/g, '') : '';

          const currentDebug: any = {
            filename: file.name,
            rawResult: contactData.raw_data,
            extractedName: contactData.name,
            extractedPhone: contactData.phone,
            normalizedName: contactData.name,
            normalizedPhone: contactData.phone,
            isNameValid: contactData.name && contactData.name.length >= 2 && !contactData.name.toLowerCase().includes("erro"),
            isPhoneValid: phoneDigits.length >= 8,
            serverStatus: contactData.needsReview ? 'review' : 'valid',
            reviewReason: contactData.reviewReason || 'Extração direta',
            decisionStep: 'frontend-gemini',
            decisionRule: 'Chamada Direta Gemini API'

          };

          // 1. Verificar duplicata no mesmo lote
          if (phoneDigits && batchPhones.has(phoneDigits)) {
            console.log(`[IMPORT] Duplicata no lote detectada: ${phoneDigits}`);
            dupCount++;
            currentDebug.statusSentToDB = 'duplicate-batch';
            setDebugData(currentDebug);
            continue;
          }
          
          if (phoneDigits) {
            batchPhones.add(phoneDigits);
          }

          // 2. Persistência com tratamento de status
          try {
            const savedContact = await saveContact({ 
              data: { 
                name: contactData.name || 'Cliente', 
                phone: contactData.phone,
                needsReview: !contactData.name || !contactData.phone,
                reviewReason: (!contactData.name || !contactData.phone) ? 'Dados incompletos na extração' : null,
                rawData: contactData || null,

                status: 'new'
              } 
            });
            
            // Sucesso na gravação
            if (savedContact.needs_review) {
              revCount++;
            } else {
              newCount++;
            }
            currentDebug.statusSavedInDB = savedContact.needs_review ? 'review' : 'new';
          } catch (err: any) {
            if (err.message === 'DUPLICATE_CONTACT') {
              console.log(`[IMPORT] Duplicata no banco detectada para: ${phoneDigits}`);
              dupCount++;
              currentDebug.statusSavedInDB = 'duplicate';
            } else {
              console.error(`[IMPORT_ERROR] Falha na gravação do contato:`, err);
              revCount++;
              currentDebug.statusSavedInDB = 'error';
              toast.error(`Erro ao salvar contato ${contactData.name}: ${err.message}`);
            }
          }
          
          setDebugData(currentDebug);
        }
      } catch (err: any) {
        console.error("[IMPORT_ERROR]:", err);
        const errorMessage = err.message || "Erro desconhecido ao processar imagem";
        // Feedback visual detalhado
        toast.error(`Falha ao processar ${file.name}: ${errorMessage}`);
        revCount++;
      }

      setProgress(((i + 1) / files.length) * 100)
    }

    setSummary({ processed: files.length, new: newCount, duplicates: dupCount, review: revCount })
    setProcessing(false)
    setFiles([])
    queryClient.invalidateQueries({ queryKey: ['contacts'] })
  }

  const handleControlledTest = async () => {
    setIsTesting(true)
    setTestResults([])
    setSummary(null)
    
    const tests = [
      { name: "João da Silva", phone: "16999999999", expected: "new" },
      { name: "Maria de Souza", phone: "16977776666", expected: "new" },
      { name: "Pedro Oliveira", phone: "(16) 98888-7777", expected: "new" }
    ]

    let results = []
    let newCount = 0
    let dupCount = 0
    let revCount = 0

    for (const test of tests) {
      try {
        const result = await runControlledTest({ data: { name: test.name, phone: test.phone } })
        
        let statusSaved = 'error'
        let dbDetails = ''
        try {
          const payload = { 
            name: result.name, 
            phone: result.phone,
            needsReview: !!result.needsReview,
            reviewReason: result.reviewReason || null,
            rawData: result.raw_data || null
          };
          
          console.log(`[TESTE] Enviando payload:`, payload);
          const saved = await saveContact({ data: payload });
          console.log(`[TESTE] Retorno do banco:`, saved);
          
          statusSaved = saved.needs_review ? 'review' : 'new'
          if (saved.needs_review) revCount++
          else newCount++
        } catch (err: any) {
          console.error(`[TESTE] Erro capturado no frontend:`, err);
          dbDetails = err.message;
          if (err.message === 'DUPLICATE_CONTACT') {
            statusSaved = 'duplicate'
            dupCount++
          } else if (err.message.includes('DB_INSERT_ERROR')) {
            statusSaved = 'DB_ERROR'
            revCount++
          } else {
            statusSaved = 'ERROR'
            revCount++
          }
        }

        results.push({
          ...test,
          normalizedName: result.name,
          normalizedPhone: result.phone,
          isNameValid: result.isNameValid,
          isPhoneValid: result.isPhoneValid,
          statusCalculated: result.needsReview ? 'review' : 'new',
          statusSaved: statusSaved,
          dbDetails: dbDetails
        })
      } catch (err) {
        console.error("Erro no teste artificial:", err)
      }
    }

    setTestResults(results)
    setSummary({ processed: tests.length, new: newCount, duplicates: dupCount, review: revCount })
    setIsTesting(false)
    queryClient.invalidateQueries({ queryKey: ['contacts'] })
  }

  const filteredContacts = contacts?.filter((c: any) => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone_normalized.includes(searchTerm)
  )

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

          <Button 
            variant="outline" 
            onClick={handleControlledTest} 
            disabled={isTesting || processing}
            className="flex items-center gap-2 border-yellow-500/50 text-yellow-600 hover:bg-yellow-50"
          >
            <Beaker className="h-4 w-4" />
            {isTesting ? 'Testando...' : '🧪 TESTAR CLASSIFICAÇÃO'}
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-primary/20 bg-primary/5">
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
              
              {files.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{files.length} arquivos selecionados</span>
                    <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 text-xs">
                      Limpar
                    </Button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                    {files.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-2 bg-background rounded border">
                        <span className="truncate max-w-[150px]">{file.name}</span>
                        <Button variant="ghost" size="icon" onClick={() => removeFile(idx)} className="h-6 w-6">
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button 
                    className="w-full font-bold" 
                    onClick={processImages} 
                    disabled={processing || files.length === 0}
                  >
                    {processing ? (
                      <span className="flex items-center gap-2">
                        <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        Processando...
                      </span>
                    ) : (
                      'Extrair Dados'
                    )}
                  </Button>
                </div>
              )}

              {processing && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-[10px] text-center text-muted-foreground">{Math.round(progress)}% concluído</p>
                </div>
              )}

              {summary && (
                <div className="p-4 bg-background/80 rounded-xl border border-primary/10 space-y-2 animate-in zoom-in-95 duration-300">
                  <div className="flex items-center gap-2 text-sm font-bold border-b pb-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Resultados do Processamento
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex flex-col bg-muted/30 p-2 rounded">
                      <span className="text-muted-foreground">Processados</span>
                      <span className="text-lg font-bold">{summary.processed}</span>
                    </div>
                    <div className="flex flex-col bg-green-500/10 p-2 rounded">
                      <span className="text-green-600">Novos</span>
                      <span className="text-lg font-bold text-green-700">{summary.new}</span>
                    </div>
                    <div className="flex flex-col bg-yellow-500/10 p-2 rounded">
                      <span className="text-yellow-600">Duplicados</span>
                      <span className="text-lg font-bold text-yellow-700">{summary.duplicates}</span>
                    </div>
                    <div className="flex flex-col bg-red-500/10 p-2 rounded">
                      <span className="text-red-600">Revisar</span>
                      <span className="text-lg font-bold text-red-700">{summary.review}</span>
                    </div>
                  </div>
                </div>
              )}

              {testResults && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl space-y-4 animate-in slide-in-from-top-2">
                  <h3 className="text-sm font-bold text-yellow-800 flex items-center gap-2">
                    <Beaker className="h-4 w-4" />
                    ========== TESTE CONTROLADO ==========
                  </h3>
                  
                  {testResults.map((res, idx) => (
                    <div key={idx} className="text-[10px] font-mono space-y-1 bg-white/50 p-2 rounded border border-yellow-100">
                      <div className="font-bold text-yellow-900 border-b border-yellow-200 pb-1 mb-1">Teste {idx + 1}: {res.name}</div>
                      <div>Nome: {res.name}</div>
                      <div>Telefone Original: {res.phone}</div>
                      <div>Telefone Normalizado: {res.normalizedPhone}</div>
                      <div>Nome válido: {String(res.isNameValid)}</div>
                      <div>Telefone válido: {String(res.isPhoneValid)}</div>
                      <div className="font-bold">Status calculado: {res.statusCalculated}</div>
                      <div className="font-bold">Status banco: {res.statusSaved}</div>
                      {res.dbDetails && <div className="text-red-600 bg-red-50 p-1 mt-1 rounded border border-red-100 break-all">Erro DB: {res.dbDetails}</div>}
                      <div className="font-bold">Status real: {res.statusSaved === 'duplicate' ? 'duplicate' : (res.statusSaved === 'DB_ERROR' ? 'DB_ERROR' : (res.statusSaved === 'new' ? 'new' : 'review'))}</div>
                    </div>
                  ))}
                  
                  <div className="pt-2 border-t border-yellow-200 text-[10px] font-mono">
                    <div>Contador Novos: {summary?.new}</div>
                    <div>Contador Duplicados: {summary?.duplicates}</div>
                    <div>Contador Revisar: {summary?.review}</div>
                    <div className="mt-2 font-bold text-sm text-yellow-900">
                      TESTE ARTIFICIAL: {(summary?.new || 0) + (summary?.duplicates || 0) === 3 && summary?.review === 0 ? '✅ PASSOU' : '❌ FALHOU'}
                    </div>
                  </div>
                  
                  <div className="text-[10px] text-yellow-700 italic">
                    =======================================
                  </div>
                </div>
              )}

              {debugData && (
                <div className="p-4 bg-slate-900 text-slate-100 rounded-xl border border-slate-700 space-y-3 font-mono text-[10px] overflow-x-auto">
                  <div className="flex items-center gap-2 text-xs font-bold border-b border-slate-700 pb-2 mb-2 text-blue-400">
                    <Search className="h-4 w-4" />
                    🔎 Diagnóstico da Última Captura
                  </div>
                  
                  <div className="grid gap-2">
                    <div><span className="text-slate-400">Arquivo:</span> {debugData.filename}</div>
                    <div>
                      <span className="text-slate-400">Resultado bruto da IA/OCR:</span>
                      <pre className="mt-1 p-2 bg-black/50 rounded max-h-32 overflow-y-auto whitespace-pre-wrap">
                        {JSON.stringify(debugData.rawResult, null, 2)}
                      </pre>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div><span className="text-slate-400">Nome extraído:</span> {debugData.extractedName}</div>
                      <div><span className="text-slate-400">Telefone extraído:</span> {debugData.extractedPhone}</div>
                      <div><span className="text-slate-400">Nome normalizado:</span> {debugData.normalizedName}</div>
                      <div><span className="text-slate-400">Telefone normalizado:</span> {debugData.normalizedPhone}</div>
                      <div><span className="text-slate-400">Nome válido:</span> {debugData.isNameValid ? 'SIM' : 'NÃO'}</div>
                      <div><span className="text-slate-400">Telefone válido:</span> {debugData.isPhoneValid ? 'SIM' : 'NÃO'}</div>
                      <div><span className="text-slate-400">Confiança IA:</span> {debugData.confidence || 'N/A'}</div>
                      <div><span className="text-slate-400">Duplicado:</span> {debugData.isDuplicate || 'NÃO'}</div>
                    </div>

                    <div className="border-t border-slate-700 pt-2 mt-2 space-y-1">
                      <div><span className="text-slate-400">Status calculado pelo servidor:</span> <span className={debugData.serverStatus === 'review' ? 'text-red-400' : 'text-green-400'}>{debugData.serverStatus}</span></div>
                      <div><span className="text-slate-400">Status enviado para o banco:</span> {debugData.statusSentToDB}</div>
                      <div><span className="text-slate-400">Status efetivamente salvo:</span> {debugData.statusSavedInDB}</div>
                      <div><span className="text-slate-400">Status retornado para o frontend:</span> {debugData.statusReturnedToFront}</div>
                      <div><span className="text-slate-400">Motivo da revisão:</span> {debugData.reviewReason || 'Nenhum'}</div>
                    </div>

                    <div className="border-t border-slate-700 pt-2 mt-2 space-y-1">
                      <div className="text-blue-400 font-bold">Etapa que classificou o contato:</div>
                      <div>{debugData.decisionStep}</div>
                      <div className="text-blue-400 font-bold">Regra que causou a classificação:</div>
                      <div className="text-yellow-400">{debugData.decisionRule}</div>
                    </div>
                  </div>
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
                        <TableRow key={contact.id} className="group hover:bg-muted/30 transition-colors">
                          <TableCell className="font-medium">
                            {contact.name}
                            {contact.needs_review && (
                              <p className="text-[10px] text-red-500 font-normal mt-0.5">
                                Motivo: {contact.review_reason || 'Revisão manual necessária'}
                              </p>
                            )}
                            <p className="text-[9px] text-muted-foreground mt-0.5">
                              ID: {contact.id.substring(0, 8)} | User: {contact.user_id?.substring(0, 8)}
                            </p>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2 py-1 rounded bg-primary/10 text-primary text-xs font-mono">
                              {formatPhone(contact.phone_normalized)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {contact.needs_review ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                                <AlertCircle className="h-3 w-3" />
                                Revisar
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
                                <CheckCircle2 className="h-3 w-3" />
                                OK
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right flex items-center justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 gap-2 hover:bg-green-500 hover:text-white transition-all"
                              onClick={() => window.open(`https://wa.me/55${contact.phone_normalized}`, '_blank')}
                            >
                              <Phone className="h-3.5 w-3.5" />
                              WhatsApp
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              onClick={async () => {
                                if (confirm('Excluir este contato?')) {
                                  const { error } = await supabase.from('contacts').delete().eq('id', contact.id);
                                  if (error) toast.error('Erro ao excluir');
                                  else {
                                    toast.success('Contato excluído');
                                    queryClient.invalidateQueries({ queryKey: ['contacts'] });
                                  }
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
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
