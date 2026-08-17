import { createFileRoute } from '@tanstack/react-router'
import { DashboardHome } from '@/components/dashboard/DashboardHome'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardHome,
})
