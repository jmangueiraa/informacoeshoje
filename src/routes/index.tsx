import { createFileRoute } from '@tanstack/react-router'
import { Button } from "@/components/ui/button"
import { Link } from "@tanstack/react-router"
import { ShoppingBag, Zap, BarChart3, ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react"

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Navigation */}
      <header className="px-4 lg:px-6 h-16 flex items-center border-b sticky top-0 bg-background/80 backdrop-blur-md z-50">
        <Link to="/" className="flex items-center justify-center gap-2 font-bold text-xl tracking-tight text-primary">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground text-sm">
            LS
          </div>
          <span>Link<span className="text-foreground">Shopee</span></span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <a className="text-sm font-medium hover:text-primary transition-colors cursor-pointer" href="#features">
            Recursos
          </a>
          <a className="text-sm font-medium hover:text-primary transition-colors cursor-pointer" href="#pricing">
            Planos
          </a>
          <Link to="/auth" className="text-sm font-medium hover:text-primary transition-colors">
            Entrar
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 px-4">
          <div className="container mx-auto max-w-7xl">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-4xl font-extrabold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
                  Transforme seus links de <span className="text-primary">Afiliado Shopee</span>
                </h1>
                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl lg:text-2xl">
                  Crie links personalizados, acompanhe cliques em tempo real e aumente suas conversões com o LinkShopee.
                </p>
              </div>
              <div className="space-x-4">
                <Button asChild size="lg" className="h-12 px-8 text-lg">
                  <Link to="/auth">Começar Agora <ArrowRight className="ml-2 h-5 w-5" /></Link>
                </Button>
                <Button variant="outline" size="lg" className="h-12 px-8 text-lg" asChild>
                  <a href="#features">Saiba Mais</a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-muted/50">
          <div className="container mx-auto max-w-7xl px-4">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-center mb-12">Por que o LinkShopee?</h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col items-center space-y-4 text-center p-6 bg-background rounded-xl border shadow-sm">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Zap className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Redirecionamento Rápido</h3>
                <p className="text-muted-foreground">Tecnologia de ponta para garantir que seu cliente chegue à oferta sem atrasos.</p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center p-6 bg-background rounded-xl border shadow-sm">
                <div className="p-3 bg-primary/10 rounded-full">
                  <BarChart3 className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Analytics Completo</h3>
                <p className="text-muted-foreground">Saiba de onde vêm seus cliques, qual dispositivo usam e muito mais.</p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center p-6 bg-background rounded-xl border shadow-sm">
                <div className="p-3 bg-primary/10 rounded-full">
                  <ShieldCheck className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Totalmente Seguro</h3>
                <p className="text-muted-foreground">Não alteramos seus cookies de afiliado. O redirecionamento é 100% transparente.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="w-full py-12 md:py-24 lg:py-32">
          <div className="container mx-auto max-w-7xl px-4">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-center mb-12">Planos para todos os tamanhos</h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
              {/* Free Plan */}
              <div className="flex flex-col p-6 bg-background border rounded-xl shadow-sm relative overflow-hidden">
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold">Gratuito</h3>
                  <p className="text-muted-foreground">Ideal para começar.</p>
                </div>
                <div className="mt-4 text-4xl font-bold">R$ 0<span className="text-lg font-normal text-muted-foreground">/mês</span></div>
                <ul className="mt-6 space-y-3">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> 10 Links</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> 1.000 cliques/mês</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> Estatísticas básicas</li>
                </ul>
                <Button className="mt-8 w-full" variant="outline" asChild>
                  <Link to="/auth">Começar Grátis</Link>
                </Button>
              </div>

              {/* Pro Plan */}
              <div className="flex flex-col p-6 bg-background border-2 border-primary rounded-xl shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-bl-lg">
                  Popular
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold">Pro</h3>
                  <p className="text-muted-foreground">Para afiliados profissionais.</p>
                </div>
                <div className="mt-4 text-4xl font-bold">R$ 49,90<span className="text-lg font-normal text-muted-foreground">/mês</span></div>
                <ul className="mt-6 space-y-3">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> 500 Links</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> 100k cliques/mês</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> Estatísticas completas</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> Links expirados</li>
                </ul>
                <Button className="mt-8 w-full bg-primary" asChild>
                  <Link to="/auth">Assinar Pro</Link>
                </Button>
              </div>

              {/* Premium Plan */}
              <div className="flex flex-col p-6 bg-background border rounded-xl shadow-sm relative overflow-hidden">
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold">Premium</h3>
                  <p className="text-muted-foreground">Escalabilidade total.</p>
                </div>
                <div className="mt-4 text-4xl font-bold">R$ 99,90<span className="text-lg font-normal text-muted-foreground">/mês</span></div>
                <ul className="mt-6 space-y-3">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> Links ilimitados</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> Cliques ilimitados</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> Domínio personalizado</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> Suporte prioritário</li>
                </ul>
                <Button className="mt-8 w-full" variant="outline" asChild>
                  <Link to="/auth">Assinar Premium</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 md:py-12 bg-muted/20">
        <div className="container mx-auto max-w-7xl px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-bold text-lg">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <span>LinkShopee</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2026 LinkShopee. Todos os direitos reservados.
          </p>
          <div className="flex gap-4">
            <a href="#" className="text-sm text-muted-foreground hover:underline">Termos</a>
            <a href="#" className="text-sm text-muted-foreground hover:underline">Privacidade</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
