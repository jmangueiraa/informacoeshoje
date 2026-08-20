import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/contacts')({
  component: ContactsPage,
})

function ContactsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Captura de Contatos</h1>
      <p>Em breve...</p>
    </div>
  )
}
