import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/arquivos/$slug')({
  component: ArquivosTestPage,
})

function ArquivosTestPage() {
  const { slug } = Route.useParams()

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        fontFamily: 'sans-serif',
        color: '#111111',
      }}
    >
      <div
        style={{
          padding: '24px',
          border: '2px solid #ee4d2d',
          borderRadius: '12px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '24px', margin: '0 0 12px 0', color: '#ee4d2d' }}>
          Teste de Rota /arquivos
        </h1>
        <p style={{ fontSize: '18px', margin: 0 }}>
          Carregando slug: <strong>{slug}</strong>
        </p>
      </div>
    </div>
  )
}
