import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/arquivos/')({
  loader: () => {
    throw redirect({ to: '/' })
  },
})
