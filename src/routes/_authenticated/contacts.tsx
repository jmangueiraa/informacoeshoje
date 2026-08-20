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
        const result = await processImageOCR({ data: { imageBase64: base64 } })
        if (result.needsReview && !result.phone) {
          revCount++
        } else {
          try {
            await saveContact({ data: { name: result.name || 'Sem nome', phone: result.phone } })
            newCount++
          } catch (err) {
            dupCount++
          }
        }
      } catch (err) {
        console.error("Erro ao processar imagem:", err)
        revCount++
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
          <p className="text-muted-foreground">Extraia automaticamente nomes e telefones de imagens de logística.</p>
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
                          <TableCell className="font-medium">{contact.name}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2 py-1 rounded bg-primary/10 text-primary text-xs font-mono">
                              {formatPhone(contact.phone_normalized)}
                            </span>
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
