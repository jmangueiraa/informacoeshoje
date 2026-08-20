import { createFileRoute } from '@tanstack/react-router'
import { testAiGateway } from '@/lib/test-ai.functions'
import { useQuery } from '@tanstack/react-query'

export const Route = createFileRoute('/test-ai-route')({
  component: TestComponent,
})

function TestComponent() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['test-ai'],
    queryFn: () => testAiGateway(),
  })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {(error as Error).message}</div>

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">AI Gateway Test Results</h1>
      <pre className="bg-muted p-4 rounded-lg overflow-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}
