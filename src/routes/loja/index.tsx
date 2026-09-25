import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/loja/')({
  loader: () => {
    throw redirect({ to: '/' })
  },
})
