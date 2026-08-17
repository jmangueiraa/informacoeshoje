import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/editor/$id')({
  component: () => <div>Editor em breve</div>,
})
