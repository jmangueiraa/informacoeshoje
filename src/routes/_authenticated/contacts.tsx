import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getContacts, processImageOCR, saveContact } from '@/lib/contacts.functions'
import { formatPhone } from '@/lib/utils'
import { Trash2, Phone, Upload, CheckCircle2, AlertCircle, X, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { supabase } from '@/integrations/supabase/client'

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
        console.log(`\n========== CAPTURA DEBUG (FRONTEND) ==========\n1. ARQUIVO:\n   nome: ${file.name}\n   tipo: ${file.type}\n   tamanho: ${Math.round(file.size / 1024)} KB`);
        
        const result = await processImageOCR({ data: { imageBase64: base64, filename: file.name } });
        
        const currentDebug: any = {
          filename: file.name,
          rawResult: result.raw_data,
          extractedName: result.name,
          extractedPhone: result.phone,
          normalizedName: result.name,
          normalizedPhone: result.phone,
          isNameValid: !result.needsReview || result.reviewReason !== "Nome não identificado claramente",
          isPhoneValid: !result.needsReview || (!result.reviewReason?.includes("Telefone inválido") && !result.reviewReason?.includes("sem DDD")),
          confidence: result.raw_data?.confidence,
          serverStatus: result.needsReview ? 'review' : 'valid',
          reviewReason: result.reviewReason,
          decisionStep: 'servidor',
          decisionRule: `needsReview === ${result.needsReview}`
        };

        if (result.phone && result.phone.length >= 8) {
          try {
            const savedContact = await saveContact({ 
              data: { 
                name: result.name || 'Cliente', 
                phone: result.phone,
                needsReview: result.needsReview,
                reviewReason: result.reviewReason,
                rawData: result.raw_data
              } 
            });
            
            currentDebug.statusSentToDB = result.needsReview ? 'review' : 'new';
            currentDebug.statusSavedInDB = savedContact.needs_review ? 'review' : 'new';
            currentDebug.statusReturnedToFront = savedContact.needs_review ? 'review' : 'new';

            if (result.needsReview) {
              revCount++;
            } else {
              newCount++;
            }
          } catch (err: any) {
            if (err.message === 'DUPLICATE_CONTACT') {
              dupCount++;
              currentDebug.isDuplicate = 'SIM';
            } else {
              revCount++;
              currentDebug.decisionStep = 'frontend-fallback';
              currentDebug.decisionRule = 'catch error on save';
            }
          }
        } else {
          try {
            await saveContact({ 
              data: { 
                name: result.name || 'Cliente', 
                phone: result.phone || '00000000',
                needsReview: true,
                reviewReason: result.reviewReason || "Telefone não identificado",
                rawData: result.raw_data
              } 
            });
          } catch (e) {}
          revCount++;
          currentDebug.decisionStep = 'frontend';
          currentDebug.decisionRule = 'phone.length < 8';
        }
        
        setDebugData(currentDebug);
      } catch (err) {
        console.error("[CAPTURA] Erro crítico ao processar imagem:", err);
        revCount++;
      }

      setProgress(((i + 1) / files.length) * 100)
    }

    setSummary({ processed: files.length, new: newCount, duplicates: dupCount, review: revCount })
    setProcessing(false)
    setFiles([])
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
                        </TableRow>
                      ))
                    ) : filteredContacts?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
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
                                Motivo: {contact.review_reason}
                              </p>
                            )}
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
                          <TableCell className="text-right">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 gap-2 hover:bg-green-500 hover:text-white transition-all"
                              onClick={() => window.open(`https://wa.me/55${contact.phone_normalized}`, '_blank')}
                            >
                              <Phone className="h-3.5 w-3.5" />
                              WhatsApp
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
