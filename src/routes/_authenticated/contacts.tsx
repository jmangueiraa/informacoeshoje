import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getContacts, processImageOCR, saveContact, deleteContact } from '@/lib/contacts.functions'
import { toast } from 'sonner'
import { Trash2, Phone, Plus } from 'lucide-react'
import { formatPhone } from '@/lib/utils'

export const Route = createFileRoute('/_authenticated/contacts')({
  component: ContactsPage,
})

function ContactsPage() {
  const [files, setFiles] = useState<File[]>([])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
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

  const processImages = async () => {
    setProcessing(true)
    setProgress(0)
    let newCount = 0
    let dupCount = 0
    let revCount = 0

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;

      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      try {
        const result = await processImageOCR({ data: { imageBase64: base64 } });
        if (result.needsReview || !result.phone) {
          revCount++;
        } else {
          try {
            await saveContact({ data: { name: result.name || 'Sem nome', phone: result.phone } });
            newCount++;
          } catch (err) {
            dupCount++;
          }
        }
      } catch (err) {
        console.error("Erro ao processar imagem:", err);
        revCount++;
      }


      setProgress(((i + 1) / files.length) * 100)
    }

    setSummary({ processed: files.length, new: newCount, duplicates: dupCount, review: revCount })
    setProcessing(false)
    setFiles([])
    queryClient.invalidateQueries({ queryKey: ['contacts'] })
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Captura de Contatos</h1>
      
      <Card>
        <CardContent className="p-6">
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer ${isDragActive ? 'border-primary' : 'border-muted'}`}
          >
            <input {...getInputProps()} />
            <p className="text-muted-foreground">Arraste e solte imagens aqui ou clique para selecionar</p>
          </div>
          
          <div className="mt-4 flex gap-4 items-center">
            <p>{files.length} imagens selecionadas</p>
            <Button onClick={processImages} disabled={processing || files.length === 0}>
              {processing ? 'Processando...' : 'Processar imagens'}
            </Button>
          </div>

          {processing && (
            <div className="mt-4 space-y-2">
              <Progress value={progress} />
            </div>
          )}

          {summary && (
            <div className="mt-6 p-4 bg-muted rounded-lg space-y-1">
              <p className="font-semibold text-lg">Resultado:</p>
              <p>{summary.processed} imagens processadas</p>
              <p className="text-green-600">{summary.new} novos contatos</p>
              <p className="text-yellow-600">{summary.duplicates} duplicados ignorados</p>
              <p className="text-red-600">{summary.review} precisam de revisão</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts?.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell>{contact.name}</TableCell>
                <TableCell>{formatPhone(contact.phone_normalized)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => window.open(`https://wa.me/${contact.phone_normalized}`, '_blank')}>
                    <Phone className="h-4 w-4 mr-2" />
                    WhatsApp
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
