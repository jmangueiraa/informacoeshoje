import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, Type, Download, Trash2, Sparkles, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/editor/$id')({
  validateSearch: z.object({
    imageUrl: z.string().optional(),
    title: z.string().optional(),
    source: z.string().optional(),
  }),
  component: EditorPage,
})

function EditorPage() {
  const { imageUrl: initialImageUrl, title: initialTitle, source: initialSource } = Route.useSearch()
  
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl || null)
  const [title, setTitle] = useState(initialTitle || '')
  const [source, setSource] = useState(initialSource || '')
  const [curiosity, setCuriosity] = useState('')
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Atualiza a imagem quando muda via busca (ex: vindo do Viral Agora)
  useEffect(() => {
    if (initialImageUrl) setImageUrl(initialImageUrl)
    if (initialTitle) setTitle(initialTitle)
    if (initialSource) setSource(initialSource)
  }, [initialImageUrl, initialTitle, initialSource])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setImageUrl(event.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const generateCuriosity = () => {
    const curiosities = [
      "Você sabia que o primeiro site da web ainda está no ar?",
      "O recorde mundial de velocidade na internet foi atingido no Japão.",
      "Cerca de 90% dos dados mundiais foram criados nos últimos 2 anos.",
      "A primeira câmera do mundo levou 8 horas para tirar uma foto.",
      "O Brasil é um dos países que mais consome notícias via redes sociais."
    ]
    const random = curiosities[Math.floor(Math.random() * curiosities.length)]
    setCuriosity(random)
    toast.success("Curiosidade gerada!")
  }

  const drawCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas || !imageUrl) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = imageUrl
    img.onload = () => {
      // Ajustar canvas para o tamanho da imagem
      canvas.width = img.width
      canvas.height = img.height

      // Desenhar imagem
      ctx.drawImage(img, 0, 0)

      // Overlay escuro no rodapé para leitura
      if (curiosity || title) {
        const gradient = ctx.createLinearGradient(0, canvas.height * 0.7, 0, canvas.height)
        gradient.addColorStop(0, 'rgba(0,0,0,0)')
        gradient.addColorStop(1, 'rgba(0,0,0,0.8)')
        ctx.fillStyle = gradient
        ctx.fillRect(0, canvas.height * 0.6, canvas.width, canvas.height * 0.4)
      }

      // Desenhar Título
      if (title) {
        ctx.fillStyle = 'white'
        ctx.font = `bold ${Math.floor(canvas.width * 0.04)}px Inter, sans-serif`
        ctx.textAlign = 'left'
        ctx.fillText(title, canvas.width * 0.05, canvas.height * 0.75, canvas.width * 0.9)
      }

      // Desenhar Curiosidade
      if (curiosity) {
        ctx.fillStyle = '#fbbf24' // Yellow-400
        ctx.font = `${Math.floor(canvas.width * 0.03)}px Inter, sans-serif`
        ctx.textAlign = 'left'
        
        // Quebra de linha simples para curiosidade
        const words = curiosity.split(' ')
        let line = ''
        let y = canvas.height * 0.85
        const maxWidth = canvas.width * 0.9
        const lineHeight = canvas.width * 0.04

        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' '
          const metrics = ctx.measureText(testLine)
          if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, canvas.width * 0.05, y)
            line = words[n] + ' '
            y += lineHeight
          } else {
            line = testLine
          }
        }
        ctx.fillText(line, canvas.width * 0.05, y)
      }

      // Marca d'água
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.font = `${Math.floor(canvas.width * 0.02)}px Inter, sans-serif`
      ctx.textAlign = 'right'
      ctx.fillText('FakeNews Studio', canvas.width - 20, canvas.height - 20)
    }
  }

  useEffect(() => {
    drawCanvas()
  }, [imageUrl, title, curiosity])

  const downloadImage = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `fakenews-studio-${Date.now()}.png`
    link.href = canvas.toDataURL()
    link.click()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Editor de Notícia</h1>
          <p className="text-muted-foreground">Crie sua imagem viral personalizada.</p>
        </div>
        <div className="flex gap-2">
          {imageUrl && (
            <>
              <Button variant="outline" onClick={() => { setImageUrl(null); setCuriosity(''); }} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" /> Limpar
              </Button>
              <Button onClick={downloadImage}>
                <Download className="h-4 w-4 mr-2" /> Exportar
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[400px,1fr]">
        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" /> 1. Upload
            </h2>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors bg-muted/20"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleFileUpload}
              />
              <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Clique para subir imagem</p>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG ou WEBP</p>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Type className="h-5 w-5 text-primary" /> 2. Conteúdo
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Título</label>
                <Input 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Novo recorde mundial..."
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium">Curiosidade</label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={generateCuriosity}
                    className="h-7 text-[10px] text-primary hover:text-primary hover:bg-primary/10"
                  >
                    <Sparkles className="h-3 w-3 mr-1" /> Gerar IA
                  </Button>
                </div>
                <textarea 
                  value={curiosity}
                  onChange={(e) => setCuriosity(e.target.value)}
                  className="w-full min-h-[100px] p-3 text-sm rounded-md border border-input bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Uma curiosidade que gere impacto..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Fonte</label>
                <Input 
                  value={source} 
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Ex: UOL Notícias"
                />
              </div>
            </div>
          </Card>
        </div>
        
        <div className="space-y-4">
          <div className="bg-card border rounded-xl overflow-hidden shadow-2xl sticky top-6">
            <div className="p-4 border-b flex items-center justify-between bg-muted/30">
              <h2 className="text-sm font-medium flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Preview em Tempo Real
              </h2>
              <Badge variant="outline" className="text-[10px]">HD PREVIEW</Badge>
            </div>
            
            <div className="relative flex items-center justify-center min-h-[500px] bg-black/95 p-8">
              {imageUrl ? (
                <div className="relative max-w-full">
                  <canvas 
                    ref={canvasRef} 
                    className="max-w-full h-auto rounded shadow-2xl"
                  />
                  <div className="absolute top-4 left-4 pointer-events-none">
                     <Badge className="bg-primary/80 backdrop-blur-sm border-none">LIVE EDIT</Badge>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 bg-muted/20 rounded-full flex items-center justify-center mx-auto border-2 border-dashed border-muted-foreground/30">
                    <Upload className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground font-medium">Aguardando imagem...</p>
                    <p className="text-xs text-muted-foreground/60">Suba uma foto para começar a editar</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Badge({ children, className, variant = "default" }: { children: React.ReactNode, className?: string, variant?: "default" | "outline" }) {
  const variants = {
    default: "bg-primary text-primary-foreground",
    outline: "border border-input text-foreground"
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}
