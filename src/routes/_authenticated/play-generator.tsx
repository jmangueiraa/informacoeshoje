import { createFileRoute } from '@tanstack/react-router'
import { PlayGenerator } from '@/components/dashboard/PlayGenerator'

export const Route = createFileRoute('/_authenticated/play-generator')({
  component: PlayGeneratorPage,
})

function PlayGeneratorPage() {
  return (
    <div className="container mx-auto p-6 space-y-8 max-w-7xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gerador de Play</h1>
        <p className="text-muted-foreground">Adicione botões de play profissionais às suas imagens Shopee.</p>
      </div>
      <PlayGenerator />
    </div>
  )
}
