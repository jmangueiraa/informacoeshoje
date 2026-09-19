import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Lock, QrCode, CheckCircle2, Copy, Sparkles, Loader2, RefreshCw, MessageSquare } from "lucide-react"
import { createMercadoPagoPixOrder, checkMercadoPagoPaymentStatus } from "@/lib/mercadopago.functions"
import { toast } from "sonner"

interface SubscriptionExpiredCardProps {
  userName?: string
  expiresAt?: string
  isTrial?: boolean
  onRenewSuccess?: () => void
}

export function SubscriptionExpiredCard({
  userName,
  expiresAt,
  isTrial = false,
  onRenewSuccess,
}: SubscriptionExpiredCardProps) {
  const [loadingPix, setLoadingPix] = useState(false)
  const [pixData, setPixData] = useState<{
    orderId: string
    paymentId: string
    qrCode: string
    qrCodeBase64: string
    amount: number
    isNativeMp: boolean
  } | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isApproved, setIsApproved] = useState(false)
  const [copied, setCopied] = useState(false)

  // Gerar Pix de R$ 30,00
  const handleGeneratePix = async () => {
    setLoadingPix(true)
    try {
      const res = await createMercadoPagoPixOrder({ data: { amount: 30.00 } })
      if (res && res.success) {
        setPixData(res)
        toast.success("Código Pix gerado com sucesso!")
      } else {
        toast.error("Erro ao gerar Pix. Tente novamente.")
      }
    } catch (err: any) {
      console.error("Erro ao gerar Pix:", err)
      toast.error(err.message || "Falha ao conectar com o serviço de pagamento.")
    } finally {
      setLoadingPix(false)
    }
  }

  // Polling automático para verificar aprovação do Pix no Mercado Pago
  useEffect(() => {
    if (!pixData?.paymentId || isApproved) return

    const interval = setInterval(async () => {
      try {
        setIsChecking(true)
        const checkRes = await checkMercadoPagoPaymentStatus({ data: { paymentId: pixData.paymentId } })
        if (checkRes.paid) {
          setIsApproved(true)
          clearInterval(interval)
          toast.success("🎉 Pagamento Aprovado! Seu acesso foi liberado com sucesso!")
          if (onRenewSuccess) {
            setTimeout(() => onRenewSuccess(), 1500)
          } else {
            setTimeout(() => window.location.reload(), 1500)
          }
        }
      } catch (err) {
        // Silêncio em polling de verificação
      } finally {
        setIsChecking(false)
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [pixData, isApproved, onRenewSuccess])

  const copyPixCode = () => {
    if (!pixData?.qrCode) return
    navigator.clipboard.writeText(pixData.qrCode)
    setCopied(true)
    toast.success("Código Pix Copia e Cola copiado!")
    setTimeout(() => setCopied(false), 3000)
  }

  const formattedDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'recentemente'

  if (isApproved) {
    return (
      <Card className="w-full max-w-2xl mx-auto border-green-500/30 bg-green-500/5 shadow-2xl animate-in zoom-in-95 duration-300">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-3">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <CardTitle className="text-2xl font-bold text-green-600 dark:text-green-400">
            Assinatura Renovada com Sucesso!
          </CardTitle>
          <CardDescription className="text-base">
            Seu pagamento foi confirmado pelo Mercado Pago e seu acesso foi estendido por +30 dias.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center pb-8">
          <Button
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white font-semibold"
            onClick={() => window.location.reload()}
          >
            Acessar Sistema Agora
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-2xl mx-auto border-orange-500/30 bg-card/95 backdrop-blur shadow-2xl">
      <CardHeader className="text-center pb-4 space-y-2">
        <div className="mx-auto w-14 h-14 bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center border border-orange-500/20">
          <Lock className="w-7 h-7" />
        </div>
        <div className="flex justify-center">
          <Badge variant="outline" className="border-orange-500/40 text-orange-500 px-3 py-1 font-medium text-xs">
            {isTrial ? "⚡ Período de Teste Grátis Finalizado" : "🔒 Assinatura Mensal Vencida"}
          </Badge>
        </div>
        <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight">
          Para continuar, renove seu plano
        </CardTitle>
        <CardDescription className="text-sm sm:text-base max-w-lg mx-auto">
          {isTrial
            ? `Seu período de teste de 7 dias encerrou em ${formattedDate}. Renove para manter seus links ativos e continuar rastreando suas vendas da Shopee.`
            : `Sua assinatura mensal encerrou em ${formattedDate}. Renove para continuar com acesso total à ferramenta.`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Card do Preço */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-xl p-5 text-center flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-left space-y-1">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Plano Mensal Completo</span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl sm:text-4xl font-extrabold text-foreground">R$ 30,00</span>
              <span className="text-sm text-muted-foreground font-medium">/mês</span>
            </div>
            <p className="text-xs text-muted-foreground">30 dias de acesso com renovação automática via Pix.</p>
          </div>

          {!pixData && (
            <Button
              size="lg"
              onClick={handleGeneratePix}
              disabled={loadingPix}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 gap-2 h-12 px-6"
            >
              {loadingPix ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Gerando Pix...
                </>
              ) : (
                <>
                  <QrCode className="w-5 h-5" />
                  Pagar via Pix (R$ 30,00)
                </>
              )}
            </Button>
          )}
        </div>

        {/* Exibição do QR Code e Pix Copia e Cola */}
        {pixData && (
          <div className="border border-border rounded-xl p-5 bg-muted/30 space-y-5 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <QrCode className="w-4 h-4 text-primary" />
                <span>Pague pelo seu App do Banco</span>
              </div>
              <Badge variant="secondary" className="gap-1.5 text-xs">
                {isChecking ? <Loader2 className="w-3 h-3 animate-spin text-primary" /> : <RefreshCw className="w-3 h-3" />}
                Verificando pagamento...
              </Badge>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
              {/* QR Code Imagem se houver base64 do Mercado Pago */}
              {pixData.qrCodeBase64 ? (
                <div className="p-3 bg-white rounded-lg shadow-md border">
                  <img
                    src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                    alt="QR Code Pix Mercado Pago"
                    className="w-44 h-44 object-contain"
                  />
                </div>
              ) : (
                <div className="w-44 h-44 bg-muted border border-dashed rounded-lg flex flex-col items-center justify-center p-3 text-center text-xs text-muted-foreground">
                  <QrCode className="w-12 h-12 text-muted-foreground/60 mb-2" />
                  <span>Utilize a chave Copia e Cola ao lado</span>
                </div>
              )}

              <div className="flex-1 space-y-3 w-full">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Código Pix Copia e Cola:</label>
                  <div className="p-2.5 bg-background border rounded-lg font-mono text-xs break-all max-h-24 overflow-y-auto select-all">
                    {pixData.qrCode}
                  </div>
                </div>

                <Button
                  onClick={copyPixCode}
                  className="w-full gap-2 font-semibold"
                  variant={copied ? "default" : "secondary"}
                >
                  {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Código Copiado!" : "Copiar Código Pix"}
                </Button>

                <p className="text-[11px] text-muted-foreground text-center">
                  💡 Após pagar no app do seu banco, o sistema reconhece a aprovação automaticamente em segundos.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Benefícios Inclusos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-muted-foreground pt-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            <span>Links de afiliado ilimitados</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            <span>Deep Link para App da Shopee</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            <span>Validação dupla de 7 dias (Cookies + IP)</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            <span>Notificações e Suporte Prioritário</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground bg-muted/10">
        <span>Desenvolvido pela AJP Entretenimento</span>
        <a
          href="https://wa.me/5519981356505?text=Ol%C3%A1%2C%20gostaria%20de%20ajuda%20com%20a%20minha%20assinatura%20do%20LinkAfiliado"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Falar com Suporte (WhatsApp)
        </a>
      </CardFooter>
    </Card>
  )
}
