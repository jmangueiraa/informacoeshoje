import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Seja Bem-Vindo — Sua Nova Jornada" },
      {
        name: "description",
        content:
          "Uma página de boas-vindas acolhedora para começar sua nova jornada.",
      },
      { property: "og:title", content: "Seja Bem-Vindo — Sua Nova Jornada" },
      {
        property: "og:description",
        content:
          "Uma página de boas-vindas acolhedora para começar sua nova jornada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-20">
      {/* Decorative background shapes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-[50rem] w-[50rem] rounded-full bg-welcome-1/20 blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 h-[40rem] w-[40rem] rounded-full bg-welcome-2/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-2xl text-center">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground shadow-sm">
          <span className="inline-block h-2 w-2 rounded-full bg-welcome-2" />
          Novo por aqui?
        </span>

        <h1 className="text-balance text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
          Seja bem-vindo!
        </h1>

        <p className="mt-6 text-balance text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Estamos muito felizes em ter você por aqui. Explore, descubra e
          aproveite cada momento desta nova jornada.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background">
            Começar agora
          </button>
          <button className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-card px-8 text-base font-semibold text-foreground transition-all hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background">
            Saiba mais
          </button>
        </div>
      </div>

      {/* Feature cards */}
      <div className="relative z-10 mx-auto mt-20 grid max-w-5xl gap-6 sm:grid-cols-3">
        <FeatureCard
          title="Simples"
          description="Uma experiência limpa e intuitiva para você se sentir em casa."
        />
        <FeatureCard
          title="Acolhedor"
          description="Criado com carinho para tornar cada interação mais humana."
        />
        <FeatureCard
          title="Moderno"
          description="Design contemporâneo com tecnologia de ponta por trás."
        />
      </div>
    </main>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
