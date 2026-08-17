import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

export const Route = createFileRoute('/_authenticated/editor/$id')({
  validateSearch: z.object({
    imageUrl: z.string().optional(),
    title: z.string().optional(),
    source: z.string().optional(),
  }),
  component: EditorPage,
})

function EditorPage() {
  const { imageUrl, title, source } = Route.useSearch()
  const { id } = Route.useParams()

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Editor de Notícia</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4 border p-4 rounded-lg bg-card">
          <h2 className="text-xl font-semibold">Configurações</h2>
          <div className="space-y-2">
            <label className="text-sm font-medium">Título Sugerido</label>
            <input 
              type="text" 
              defaultValue={title} 
              className="w-full p-2 border rounded bg-background"
              placeholder="Digite o título..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Fonte</label>
            <input 
              type="text" 
              defaultValue={source} 
              className="w-full p-2 border rounded bg-background"
              placeholder="Fonte da notícia..."
            />
          </div>
        </div>
        
        <div className="space-y-4 border p-4 rounded-lg bg-card flex flex-col items-center justify-center min-h-[400px]">
          <h2 className="text-xl font-semibold w-full text-left mb-4">Preview da Imagem</h2>
          {imageUrl ? (
            <div className="relative group w-full aspect-video">
              <img src={imageUrl} alt="Preview" className="w-full h-full object-cover rounded shadow-lg" />
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-1 rounded">
                FakeNews Studio - Marca d'água
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">Nenhuma imagem selecionada</div>
          )}
        </div>
      </div>
    </div>
  )
}

