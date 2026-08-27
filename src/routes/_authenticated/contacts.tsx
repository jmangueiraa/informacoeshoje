import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useCallback, useMemo, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  Upload, 
  Copy, 
  Download, 
  Trash2, 
  Loader2, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  Table as TableIcon,
  FileSpreadsheet,
  User,
  Sparkles,
  Settings,
  Calendar,
  Filter,
  Check,
  XCircle,
  MessageSquare,
  Play,
  SkipForward,
  Pause,
  StopCircle,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeContactPhone } from "@/lib/phone";
import { processarTextoComGemini } from "@/lib/gemini-ocr.functions";
import Tesseract from 'tesseract.js';
import { createTrackingLink, ensureTrackingLink, getUserProfile } from "@/lib/links.functions";
import {
  getContacts,
  upsertExtractedContacts,
  updateContactRecord,
  deleteContactRecord,
  deleteAllContacts,
} from "@/lib/contacts.functions";
import { LINK_DOMAIN } from "@/lib/constants";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useServerFn } from "@tanstack/react-start";


export const Route = createFileRoute("/_authenticated/contacts")({
  head: () => ({
    meta: [
      { title: "Captura de Contatos (OCR) | LinkAfiliado" },
      { name: "description", content: "Extraia nome e telefone de comprovantes de entrega em lote com OCR." },
      { property: "og:title", content: "Captura de Contatos (OCR) | LinkAfiliado" },
      { property: "og:description", content: "Extraia nome e telefone de comprovantes de entrega em lote com OCR." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

interface Contact {
  name: string;
  phone: string;
  extractionDate?: string;
  lastContact?: string | null;
  nextReminder?: string | null;
  trackingSlug?: string | null;
}

interface OCRImage {
  id: string;
  file: File;
  preview: string;
  status: "pending" | "processing" | "completed" | "error";
  progress: number;
  text: string;
  contacts: Contact[];
  error?: string;
}

function dedupeContactsByPhone<T extends Contact & { id?: string }>(contacts: T[]): T[] {
  const seenPhones = new Set<string>();
  const uniqueContacts: T[] = [];

  for (const contact of contacts) {
    const phone = normalizeContactPhone(contact.phone);
    if (!phone || seenPhones.has(phone)) continue;
    seenPhones.add(phone);
    uniqueContacts.push({ ...contact, phone });
  }

  return uniqueContacts;
}

function Index() {
  const [images, setImages] = useState<OCRImage[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [overallStatus, setOverallStatus] = useState("");
  const [userApiKey, setUserApiKey] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [clientCounter, setClientCounter] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterPending, setFilterPending] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isDispatcherOpen, setIsDispatcherOpen] = useState(false);
  const [dispatcherQueue, setDispatcherQueue] = useState<(Contact & { id: string })[]>([]);
  const [dispatcherIndex, setDispatcherIndex] = useState(0);
  const [affiliateUrl, setAffiliateUrl] = useState("");
  const [userProfile, setUserProfileData] = useState<any>(null);
  const [msgTemplates, setMsgTemplates] = useState({
    first: `Olá, {primeiroNome}! Tudo bem?
Tivemos uma instabilidade no fluxo de envio do seu pacote.

Acompanhe a rota atualizada pelo rastreamento:
🔗 {linkRastreamento}

(Caso já tenha recebido a sua encomenda, favor nos responder apenas com um OK por aqui).

Equipe Shopee!`,
    reminder: `Olá {primeiroNome}, passando para saber se deu tudo certo com seu pedido! {linkRastreamento}

Equipe Shopee!`,
    tracking: `Olá {primeiroNome}, aqui está seu link de rastreio: {linkRastreamento}

Equipe Shopee!`
  });
  const itemsPerPage = 10;

  const queryClient = useQueryClient();
  const processarTexto = useServerFn(processarTextoComGemini);
  const createLink = useServerFn(createTrackingLink);
  const ensureLink = useServerFn(ensureTrackingLink);
  const getProfile = useServerFn(getUserProfile);
  const fetchContacts = useServerFn(getContacts);
  const upsertContacts = useServerFn(upsertExtractedContacts);
  const updateContactFn = useServerFn(updateContactRecord);
  const deleteContactFn = useServerFn(deleteContactRecord);
  const deleteAllContactsFn = useServerFn(deleteAllContacts);

  // ===== Fonte única de verdade: banco de dados (sincroniza entre dispositivos) =====
  const {
    data: contactsData,
    isLoading: contactsLoading,
    isFetching: contactsFetching,
    isError: contactsError,
    error: contactsErrorObj,
    refetch: refetchContacts,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => fetchContacts(),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  const extractedContacts = useMemo(
    () => (contactsData ?? []) as (Contact & { id: string })[],
    [contactsData]
  );

  const invalidateContacts = () => queryClient.invalidateQueries({ queryKey: ["contacts"] });

  const [migrationState, setMigrationState] = useState<
    { status: "idle" | "running" | "done" | "error"; migrated: number; message: string }
  >({ status: "idle", migrated: 0, message: "" });

  useEffect(() => {
    const savedKey = localStorage.getItem("fototext_api_key");
    if (savedKey) setUserApiKey(savedKey);

    // Load counter
    const savedCounter = localStorage.getItem("linkafiliado_client_counter");
    if (savedCounter) setClientCounter(parseInt(savedCounter, 10));

    // Load templates
    const savedTemplates = localStorage.getItem("linkafiliado_msg_templates");
    if (savedTemplates) {
      try {
        setMsgTemplates(JSON.parse(savedTemplates));
      } catch (e) {
        console.error("Erro ao carregar templates", e);
      }
    }

    // Load profile
    getProfile().then(data => {
      if (data && !('error' in data)) {
        setUserProfileData(data);
      }
    });

    const savedAffiliateUrl = localStorage.getItem("linkafiliado_batch_url");
    if (savedAffiliateUrl) setAffiliateUrl(savedAffiliateUrl);
  }, []);

  // Migração única: envia contatos presos no localStorage deste navegador para o banco
  useEffect(() => {
    if (contactsLoading || contactsError) return;
    const saved = localStorage.getItem("linkafiliado_contacts_storage");
    if (!saved) return;

    let parsed: any[] = [];
    try {
      parsed = JSON.parse(saved);
    } catch {
      localStorage.removeItem("linkafiliado_contacts_storage");
      return;
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.removeItem("linkafiliado_contacts_storage");
      return;
    }

    const legacy = dedupeContactsByPhone(parsed as (Contact & { id?: string })[])
      .filter(c => !!normalizeContactPhone(c.phone))
      .map(c => ({
        name: c.name || "Cliente",
        phone: normalizeContactPhone(c.phone),
        trackingSlug: c.trackingSlug ?? null,
        extractionDate: c.extractionDate ?? null,
        lastContact: c.lastContact ?? null,
        nextReminder: c.nextReminder ?? null,
      }));

    if (legacy.length === 0) {
      localStorage.removeItem("linkafiliado_contacts_storage");
      return;
    }

    setMigrationState({ status: "running", migrated: 0, message: `Enviando ${legacy.length} contatos locais para o banco...` });
    upsertContacts({ data: { contacts: legacy } })
      .then(async (res: any) => {
        localStorage.removeItem("linkafiliado_contacts_storage");
        await invalidateContacts();
        setMigrationState({
          status: "done",
          migrated: res?.inserted ?? 0,
          message: `Sincronizou contatos com o banco: ${res?.inserted ?? 0} novos, ${res?.skipped ?? 0} já existiam.`,
        });
        toast.success(`Contatos locais sincronizados com o banco (${res?.inserted ?? 0} novos).`);
      })
      .catch((err: any) => {
        console.error("[CONTATOS] Falha na migração local:", err);
        setMigrationState({ status: "error", migrated: 0, message: "Falha ao sincronizar os contatos locais. Tente novamente." });
        toast.error("Não foi possível sincronizar os contatos locais com o banco.");
      });
  }, [contactsLoading, contactsError]);

  // Sync counter to localStorage
  useEffect(() => {
    localStorage.setItem("linkafiliado_client_counter", clientCounter.toString());
  }, [clientCounter]);

  useEffect(() => {
    localStorage.setItem("linkafiliado_batch_url", affiliateUrl);
  }, [affiliateUrl]);

  const saveSettings = (key: string) => {
    localStorage.setItem("fototext_api_key", key);
    setUserApiKey(key);
    setIsSettingsOpen(false);
    toast.success("Configurações salvas!");
  };

  const saveTemplates = (templates: typeof msgTemplates) => {
    localStorage.setItem("linkafiliado_msg_templates", JSON.stringify(templates));
    setMsgTemplates(templates);
    setIsTemplatesOpen(false);
    toast.success("Templates de mensagem salvos!");
  };

  // Domínio base do link de rastreio: sempre o domínio da plataforma (ou domínio personalizado do usuário).
  // Nunca o host da URL de afiliado (ex.: s.shopee.com.br), senão o link não é rastreado.
  const getTrackingDomain = () => userProfile?.custom_domain || LINK_DOMAIN;


  const buildTrackingUrl = (slug: string) => `https://${getTrackingDomain()}/${slug}`;

  const getFormattedMessage = (contact: Contact, isFirst: boolean, slugOverride?: string | null) => {
    const template = (isFirst ? msgTemplates.first : msgTemplates.reminder) || "";
    
    // Obter o primeiro nome real se possível
    const nomeExibicao = contact.name.split(' ')[0] || "Cliente";

    let message = template
      .replace(/{primeiroNome}/g, nomeExibicao)
      .replace(/{contato}/g, contact.phone || "");

    const slug = slugOverride ?? contact.trackingSlug;

    if (slug) {
      const trackingUrl = buildTrackingUrl(slug);
      message = message.replace(/{linkRastreamento}/g, trackingUrl).replace(/{link}/g, trackingUrl);
      if (!/{linkRastreamento}|{link}/.test(template) && !message.includes(trackingUrl)) {
        message = `${message}\n\n🔗 ${trackingUrl}`;
      }
    } else {
      // Se não houver slug de rastreio, remove a tag para não enviar o texto literal
      message = message.replace(/{linkRastreamento}/g, "").replace(/{link}/g, "");
    }

    // Rodapé obrigatório
    if (!/Equipe Shopee!\s*$/.test(message.trim())) {
      message = `${message.trimEnd()}\n\nEquipe Shopee!`;
    }

    return message;
  };

  const handleDispatch = async (contact: Contact & { id: string }) => {
    const isFirst = !contact.lastContact;
    const cleanPhone = normalizeContactPhone(contact.phone);
    if (cleanPhone.length !== 10 && cleanPhone.length !== 11) {
      toast.error("Contato sem telefone válido.");
      return;
    }
    const phoneWithCountry = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    // 1. Garante o link de rastreio (reutiliza se já existir)
    let slug = contact.trackingSlug || null;
    if (!slug) {
      if (!affiliateUrl) {
        toast.error("Informe a URL de Destino (SSA) da Loja para gerar o link.");
        return;
      }
      try {
        const normalizedUrl = affiliateUrl.startsWith("http") ? affiliateUrl : `https://${affiliateUrl}`;
        const result = await ensureLink({
          data: { name: contact.name, phone: cleanPhone, affiliateUrl: normalizedUrl }
        });
        slug = result.slug;
      } catch (err) {
        console.error("Erro ao gerar link de rastreio:", err);
        toast.error("Não foi possível gerar o link de rastreio.");
        return;
      }
    }

    const now = new Date();
    const next = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    try {
      await updateContactFn({
        data: {
          id: contact.id,
          lastContact: now.toISOString(),
          nextReminder: next.toISOString(),
          trackingSlug: slug,
        },
      });
      await invalidateContacts();
    } catch (err) {
      console.error("Erro ao registrar o envio no banco:", err);
      toast.error("Envio aberto, mas não foi possível registrar no banco.");
    }

    const normalizedContact = { ...contact, phone: cleanPhone };
    const message = encodeURIComponent(getFormattedMessage(normalizedContact, isFirst, slug));
    window.open(`https://wa.me/${phoneWithCountry}?text=${message}`, "_blank");
  };

  const startDispatcher = () => {
    const now = new Date();
    const queue = extractedContacts.filter(c => {
      if (!c.nextReminder) return true;
      return new Date(c.nextReminder) <= now;
    });

    if (queue.length === 0) {
      toast.info("Não há contatos pendentes para envio.");
      return;
    }

    setDispatcherQueue(dedupeContactsByPhone(queue));
    setDispatcherIndex(0);
    setIsDispatcherOpen(true);
  };

  const advanceQueue = () => {
    if (dispatcherIndex < dispatcherQueue.length - 1) {
      setDispatcherIndex(prev => prev + 1);
    } else {
      setIsDispatcherOpen(false);
      toast.success("Fila de disparos finalizada!");
    }
  };

  const handleQueueSend = () => {
    const current = dispatcherQueue[dispatcherIndex];
    if (current) {
      handleDispatch(current);
      advanceQueue();
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newImages: OCRImage[] = files.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      preview: URL.createObjectURL(file),
      status: "pending",
      progress: 0,
      text: "",
      contacts: [],
    }));

    setImages((prev) => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };



  const processOCR = async () => {
    const pendingImages = images.filter((img) => img.status === "pending" || img.status === "error");
    if (pendingImages.length === 0) return;

    setLoading(true);
    setOverallStatus("Iniciando processamento...");

    const currentImages = [...images];
    let currentIndexForClient = clientCounter;
    let addedCount = 0;
    let duplicateCount = 0;
    const seenPhones = new Set(extractedContacts.map((contact) => normalizeContactPhone(contact.phone)).filter(Boolean));

    if (!affiliateUrl) {
      toast.error("Por favor, informe a URL de Destino (SSA) da loja antes de iniciar.");
      setLoading(false);
      return;
    }

    for (let i = 0; i < currentImages.length; i++) {
      const currentImage = currentImages[i];
      if (!currentImage || (currentImage.status !== "pending" && currentImage.status !== "error")) continue;

      const currentId = currentImage.id;
      setImages((prev) =>
        prev.map((img) => (img.id === currentId ? { ...img, status: "processing", progress: 10 } : img))
      );
      setOverallStatus(`Processando imagem ${i + 1} de ${currentImages.length}...`);

      try {
        const originalFile = currentImage.file;
        
        setOverallStatus(`Executando OCR local na imagem ${i + 1}...`);
        const { data: { text } } = await Tesseract.recognize(originalFile, 'por', {
          logger: m => {
            if (m.status === 'recognizing text') {
              setImages(prev => prev.map(img => 
                img.id === currentId ? { ...img, progress: Math.round(m.progress * 90) } : img
              ));
            }
          }
        });

        setOverallStatus(`IA extraindo dados da imagem ${i + 1}...`);
        
        const aiResult = await processarTexto({
          data: {
            textoBruto: text,
            apiKey: userApiKey,
            index: currentIndexForClient - 1
          }
        });
        
        const cleanPhone = normalizeContactPhone(aiResult.contato);
        const extracted = {
          name: aiResult.primeiroNome,
          phone: cleanPhone
        };

        // Validação de Duplicidade Estrita no lote e na lista atual
        const isDuplicateInList = cleanPhone ? seenPhones.has(cleanPhone) : false;

        if (cleanPhone && isDuplicateInList) {
          duplicateCount++;
          setImages((prev) =>
            prev.map((img) =>
              img.id === currentId ? { ...img, status: "completed", text: `Duplicado ignorado: ${extracted.phone}`, contacts: [], progress: 100 } : img
            )
          );
          continue;
        }

        if (!cleanPhone || (cleanPhone.length !== 10 && cleanPhone.length !== 11)) {
          setImages((prev) =>
            prev.map((img) =>
              img.id === currentId ? { ...img, status: "completed", text: `Telefone inválido ignorado: ${aiResult.contato}`, contacts: [], progress: 100 } : img
            )
          );
          continue;
        }

        seenPhones.add(cleanPhone);
        
        if (extracted.name.startsWith("Cliente")) {
          currentIndexForClient++;
        }

        const now = new Date();
        const extractionDate = now.toISOString();

        setOverallStatus(`Gerando link de rastreio para ${extracted.name}...`);
        let trackingSlug = null;
        try {
          const link = await createLink({
            data: {
              name: extracted.name,
              phone: cleanPhone,
              affiliateUrl: affiliateUrl
            }
          });
          trackingSlug = link.slug;
        } catch (linkErr) {
          console.error("Erro ao criar link automático:", linkErr);
        }

        // Persiste imediatamente no banco (fonte única de verdade)
        try {
          await upsertContacts({
            data: {
              contacts: [{
                name: extracted.name,
                phone: cleanPhone,
                trackingSlug,
                extractionDate,
                lastContact: null,
                nextReminder: null,
              }],
            },
          });
          addedCount++;
        } catch (saveErr) {
          console.error("[CONTATOS] Erro ao salvar no banco:", saveErr);
          toast.error(`Não foi possível salvar ${extracted.name} no banco.`);
        }

        setClientCounter(currentIndexForClient);

        setImages((prev) =>
          prev.map((img) =>
            img.id === currentId ? { ...img, status: "completed", text: `Nome: ${extracted.name}, Contato: ${extracted.phone}`, contacts: [extracted], progress: 100 } : img
          )
        );
      } catch (err) {
        console.error(err);
        setImages((prev) =>
          prev.map((img) =>
            img.id === currentId ? { ...img, status: "error", error: "Erro no processamento" } : img
          )
        );
        toast.error(`Erro ao processar imagem ${i + 1}`);
      }
    }

    setLoading(false);
    setOverallStatus("Processamento concluído!");
    
    if (duplicateCount > 0) {
      toast.success(`${addedCount} contatos adicionados e ${duplicateCount} duplicados ignorados.`);
    } else {
      toast.success(`${addedCount} contatos processados com sucesso!`);
    }
  };

  const clearAll = () => {
    images.forEach((img) => URL.revokeObjectURL(img.preview));
    setImages([]);
    setOverallStatus("");
    toast.info("Fila de arquivos limpa");
  };

  const clearContacts = () => {
    setExtractedContacts([]);
    setClientCounter(1);
    localStorage.removeItem("linkafiliado_contacts_storage");
    localStorage.removeItem("linkafiliado_client_counter");
    toast.info("Lista de contatos limpa");
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter((i) => i.id !== id);
    });
  };

  const consolidatedText = useMemo(() => {
    return images
      .filter((img) => img.status === "completed")
      .map((img, idx) => `--- Imagem ${idx + 1}: ${img.file.name} ---\n\n${img.text}\n`)
      .join("\n");
  }, [images]);

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.info("Texto copiado!");
  };

  const downloadText = () => {
    const blob = new Blob([consolidatedText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fototext_batch_extraido.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateContact = (contactId: string, field: keyof Contact, value: string) => {
    const current = extractedContacts;
    let nextValue = value;

    if (field === 'phone') {
      nextValue = normalizeContactPhone(value);
      const exists = current.some(
        c => c.id !== contactId && normalizeContactPhone(c.phone) === nextValue
      );
      if (nextValue && exists) {
        toast.error("Este número já existe na lista.");
        return;
      }
    }

    // Atualização otimista no cache (UI responsiva)
    queryClient.setQueryData<(Contact & { id: string })[]>(["contacts"], (prev) =>
      (prev ?? []).map(c => (c.id === contactId ? { ...c, [field]: nextValue } : c))
    );

    // Persistência no banco (debounce por contato/campo)
    const key = `${contactId}:${field}`;
    const timers = editTimers.current;
    if (timers[key]) clearTimeout(timers[key]);
    timers[key] = setTimeout(async () => {
      try {
        if (field === 'phone' && nextValue.length !== 10 && nextValue.length !== 11) return;
        await updateContactFn({
          data: {
            id: contactId,
            ...(field === 'name' ? { name: nextValue || "Cliente" } : {}),
            ...(field === 'phone' ? { phone: nextValue } : {}),
          },
        });
        await invalidateContacts();
      } catch (err) {
        console.error("[CONTATOS] Erro ao salvar edição:", err);
        toast.error("Não foi possível salvar a alteração no banco.");
        await invalidateContacts();
      }
    }, 700);
  };

  const deleteContact = async (contactId: string) => {
    try {
      await deleteContactFn({ data: { id: contactId } });
      await invalidateContacts();
      toast.success("Contato removido");
    } catch (err) {
      console.error("[CONTATOS] Erro ao remover contato:", err);
      toast.error("Não foi possível remover o contato.");
    }
  };

  const allContacts = useMemo(() => {
    // Ordenação: Mais recentes no topo (createdAt/extractionDate decrescente)
    let sorted = dedupeContactsByPhone(extractedContacts).sort((a, b) => {
      const dateA = a.extractionDate ? new Date(a.extractionDate).getTime() : 0;
      const dateB = b.extractionDate ? new Date(b.extractionDate).getTime() : 0;
      return dateB - dateA;
    });

    if (filterPending) {
      const now = new Date();
      sorted = sorted.filter(c => {
        if (!c.nextReminder) return false;
        return new Date(c.nextReminder) <= now;
      });
    }
    return sorted;
  }, [extractedContacts, filterPending]);

  const pendingCount = useMemo(() => {
    const now = new Date();
    return extractedContacts.filter(c => {
      if (!c.nextReminder) return false;
      return new Date(c.nextReminder) <= now;
    }).length;
  }, [extractedContacts]);

  const totalPages = Math.ceil(allContacts.length / itemsPerPage);
  const paginatedContacts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return allContacts.slice(start, start + itemsPerPage);
  }, [allContacts, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);


  const exportToCSV = () => {
    if (allContacts.length === 0) return;
    const headers = ["Name", "Given Name", "Phone 1 - Value"];
    const rows = allContacts.map(c => [
      c.name, 
      c.name, 
      c.phone
    ]);
    const csvContent = [headers, ...rows].map(e => e.map(val => `"${val}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "contatos.csv");
    link.click();
    toast.success("CSV exportado!");
  };

  const copyFormattedList = () => {
    const text = allContacts
      .map(c => `${c.name}: ${c.phone}`)
      .join("\n");
    copyToClipboard(text);
  };

  const totalProgress = useMemo(() => {
    if (images.length === 0) return 0;
    const completed = images.filter((img) => img.status === "completed").length;
    const processing = images.find((img) => img.status === "processing");
    const currentProgress = processing ? processing.progress / images.length : 0;
    return Math.round((completed / images.length) * 100 + currentProgress);
  }, [images]);

  return (
    <TooltipProvider>
    <div className="min-h-screen bg-background p-6 md:p-12 font-sans selection:bg-primary/10 selection:text-primary relative">
      <div className="max-w-5xl mx-auto space-y-8 animate-float">
        <header className="relative text-center space-y-2">
          <div className="absolute top-0 right-0">
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Settings className="size-5" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Chave de API (Google Gemini / OpenAI / Groq)</DialogTitle>
                  <DialogDescription>
                    Insira sua chave de API para habilitar a extração inteligente de contatos. 
                    Se usar uma chave do Google Gemini (AIzaSy...), a extração será feita via IA.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="apiKey">Chave de API (Google Gemini / OpenAI / Groq)</Label>
                    <Input 
                      id="apiKey" 
                      type="password" 
                      placeholder="sk-..." 
                      value={userApiKey}
                      onChange={(e) => setUserApiKey(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => saveSettings(userApiKey)}>Salvar Configurações</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="size-8 bg-primary rounded-lg flex items-center justify-center">
              <FileText className="size-5 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-extrabold tracking-tighter">Extrator de Contatos</h1>
          </div>
          <p className="text-muted-foreground text-lg">Extração inteligente de contatos da Shopee via Google Gemini (Processamento de Texto)</p>
        </header>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Coluna de Upload e Fila */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
              <CardContent 
                className="p-8 flex flex-col items-center text-center cursor-pointer" 
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  multiple 
                  onChange={handleImageUpload} 
                />
                <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Upload className="size-6 text-muted-foreground" />
                </div>
                <p className="font-medium">Selecionar imagens</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP (Batch support)</p>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Fila de Arquivos</h3>
                {images.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearAll} disabled={loading}>
                    <Trash2 className="size-3 mr-2" /> Limpar
                  </Button>
                )}
              </div>
              
              <ScrollArea className="h-[300px] rounded-md border p-4 bg-muted/30">
                {images.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">Nenhum arquivo na fila.</p>
                ) : (
                  <div className="space-y-2">
                    {images.map((img) => (
                      <div key={img.id} className="flex items-center gap-3 rounded-md border bg-background p-2">
                        <img src={img.preview} alt={img.file.name} className="size-10 rounded object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{img.file.name}</p>
                          <Progress value={img.progress} className="h-1 mt-1" />
                        </div>
                        {img.status === "processing" && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                        {img.status === "completed" && <CheckCircle2 className="size-4 text-emerald-500" />}
                        {img.status === "error" && <Trash2 className="size-4 text-destructive" />}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">URL de Destino (SSA) da Loja</Label>
                  <Input 
                    placeholder="https://shope.ee/..." 
                    value={affiliateUrl}
                    onChange={(e) => setAffiliateUrl(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <Button className="w-full" onClick={processOCR} disabled={loading || images.length === 0 || images.every(i => i.status === 'completed')}>
                  {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : "Iniciar Batch e Criar Links"}
                </Button>
              </div>

              {loading && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex justify-between text-xs font-medium">
                    <span>Progresso Geral</span>
                    <span>{totalProgress}%</span>
                  </div>
                  <Progress value={totalProgress} className="h-2" />
                  <p className="text-[10px] text-center text-muted-foreground font-mono">{overallStatus}</p>
                </div>
              )}
            </div>
          </div>

          {/* Coluna de Resultados */}
          <div className="lg:col-span-2">
            <Card className="h-full flex flex-col min-h-[600px]">
              <div className="p-4 border-b flex items-center justify-between bg-muted/20">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500" /> Resultados Extraídos
                </h2>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    {allContacts.length} {allContacts.length === 1 ? "contato" : "contatos"}
                  </Badge>
                </div>
              </div>
              
              <div className="flex-1 flex flex-col p-6">
                {allContacts.length === 0 && !images.some(img => img.status === 'processing') ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-4 opacity-40">
                    <div className="size-16 rounded-2xl bg-muted flex items-center justify-center">
                      <TableIcon className="size-8" />
                    </div>
                    <p>O texto extraído aparecerá aqui após o processamento.</p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col space-y-4">
                    <div className="flex flex-wrap justify-between items-center gap-4">
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          variant={!filterPending ? "default" : "outline"} 
                          size="sm" 
                          onClick={() => setFilterPending(false)}
                        >
                          Todos os Contatos ({extractedContacts.length})
                        </Button>
                        <Button 
                          variant={filterPending ? "default" : "outline"} 
                          size="sm" 
                          onClick={() => setFilterPending(true)}
                          className={cn(filterPending && "bg-amber-500 hover:bg-amber-600 text-white")}
                        >
                          <Filter className="size-3 mr-2" /> 
                          Lembretes Pendentes ({pendingCount})
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setIsTemplatesOpen(true)}
                        >
                          <Settings className="size-3 mr-2" /> 
                          Configurar Mensagens
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={startDispatcher}
                        >
                          <Play className="size-3 mr-2" /> 
                          Iniciar Fila de Envios ({pendingCount})
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={copyFormattedList}>
                          <Copy className="size-3 mr-2" /> Copiar Lista
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportToCSV}>
                          <FileSpreadsheet className="size-3 mr-2" /> Exportar CSV
                        </Button>
                      </div>
                    </div>
                    
                    <ScrollArea className="flex-1 h-[500px]">
                      <div className="border rounded-md overflow-hidden bg-background">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Primeiro Nome</TableHead>
                              <TableHead>Contato</TableHead>
                               <TableHead>Próximo Lembrete</TableHead>
                              <TableHead>Link</TableHead>
                              <TableHead className="text-right w-[150px]">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {allContacts.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                  {filterPending ? "Nenhum lembrete pendente no momento." : "Nenhum contato identificado. Comece processando imagens."}
                                </TableCell>
                              </TableRow>
                            ) : (
                              paginatedContacts.map((contact) => (
                                <TableRow key={contact.id}>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <User className="size-3 text-muted-foreground" />
                                      <Input 
                                        value={contact.name} 
                                        onChange={(e) => updateContact(contact.id, 'name', e.target.value)}
                                        className="h-8 text-xs"
                                      />
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Input 
                                      value={contact.phone} 
                                      onChange={(e) => updateContact(contact.id, 'phone', e.target.value)}
                                      className="h-8 text-xs"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    {contact.nextReminder ? (
                                      <div className="flex items-center gap-2">
                                        {new Date(contact.nextReminder) <= new Date() ? (
                                          <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 flex items-center gap-1">
                                            <AlertCircle className="size-2.5" /> Enviar Mensagem
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
                                            <CheckCircle2 className="size-2.5" /> Em dia
                                          </Badge>
                                        )}
                                        <span className="text-[10px] text-muted-foreground">
                                          {new Date(contact.nextReminder).toLocaleDateString('pt-BR')}
                                        </span>
                                      </div>
                                    ) : (
                                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
                                        <Clock className="size-2.5" /> Primeiro envio pendente
                                       </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {contact.trackingSlug ? (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Badge
                                            variant="outline"
                                            className="text-[10px] bg-primary/5 text-primary border-primary/20 cursor-pointer"
                                            onClick={() => copyToClipboard(buildTrackingUrl(contact.trackingSlug!))}
                                          >
                                            /{contact.trackingSlug}
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{buildTrackingUrl(contact.trackingSlug)} (clique para copiar)</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                      <div className="flex justify-end gap-1">
                                        <Button 
                                          variant="outline" 
                                          size="icon" 
                                          className="size-7"
                                          title="Copiar Contato"
                                          onClick={() => copyToClipboard(contact.phone)}
                                        >
                                          <Copy className="size-3" />
                                        </Button>
                                        
                                        {(() => {
                                          const isDisabled = contact.lastContact && contact.nextReminder 
                                            ? new Date(contact.nextReminder) > new Date() 
                                            : false;
                                          
                                          const nextDateStr = contact.nextReminder 
                                            ? new Date(contact.nextReminder).toLocaleDateString('pt-BR') 
                                            : '';
                                          
                                          const button = (
                                            <Button 
                                              variant="outline" 
                                              size="icon" 
                                              className={cn(
                                                "size-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50",
                                                isDisabled && "opacity-50 cursor-not-allowed pointer-events-auto"
                                              )}
                                              disabled={isDisabled}
                                                onClick={() => {
                                                  if (isDisabled) return;
                                                  handleDispatch(contact);
                                                  toast.success(`Lembrete para ${contact.name} reprogramado para +7 dias!`);
                                                }}
                                            >
                                              <div className="size-3 flex items-center justify-center">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                              </div>
                                            </Button>
                                          );

                                          if (isDisabled) {
                                            return (
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <span>{button}</span>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p>Mensagem enviada recentemente. Disponível novamente em {nextDateStr}</p>
                                                </TooltipContent>
                                              </Tooltip>
                                            );
                                          }

                                          return button;
                                        })()}

                                        <Button 
                                          variant="outline" 
                                          size="icon" 
                                          className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                          title="Excluir Contato"
                                          onClick={() => deleteContact(contact.id)}
                                        >
                                          <Trash2 className="size-3" />
                                        </Button>
                                      </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </ScrollArea>
                    
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-4 border-t mt-auto">
                        <p className="text-xs text-muted-foreground">
                          Mostrando de {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, allContacts.length)} de {allContacts.length} registros
                        </p>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="h-8 text-xs"
                          >
                            Anterior
                          </Button>
                          <span className="text-xs font-medium px-2">
                            Página {currentPage} de {totalPages}
                          </span>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="h-8 text-xs"
                          >
                            Próxima
                          </Button>
                        </div>
                      </div>
                    )}
                    {allContacts.length > 0 && totalPages <= 1 && (
                      <div className="pt-2">
                        <p className="text-[10px] text-muted-foreground text-center italic">
                          mostra de 10 em 10 registro
                        </p>
                      </div>
                    )}


                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Modais de Templates e Dispatcher */}
      <Dialog open={isTemplatesOpen} onOpenChange={setIsTemplatesOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Configurar Modelos de Mensagem</DialogTitle>
            <DialogDescription>
              Personalize as mensagens disparadas pelo WhatsApp. Use {"{primeiroNome}"}, {"{contato}"} e {"{linkRastreamento}"} como tags dinâmicas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Mensagem de Primeiro Contato</Label>
              <Textarea 
                value={msgTemplates.first} 
                onChange={(e) => setMsgTemplates(prev => ({ ...prev, first: e.target.value }))}
                rows={3}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Mensagem de Retorno (7 Dias)</Label>
              <Textarea 
                value={msgTemplates.reminder} 
                onChange={(e) => setMsgTemplates(prev => ({ ...prev, reminder: e.target.value }))}
                rows={3}
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTemplatesOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveTemplates(msgTemplates)}>Salvar Templates</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDispatcherOpen} onOpenChange={setIsDispatcherOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none bg-transparent shadow-none">
          <Card className="border shadow-2xl overflow-hidden">
            <div className="bg-primary p-6 text-primary-foreground">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <MessageSquare className="size-5" /> Fila de Envios
                  </h3>
                  <p className="text-primary-foreground/70 text-xs">Modo Semi-automático</p>
                </div>
                <Badge variant="outline" className="text-primary-foreground border-primary-foreground/30 bg-primary-foreground/10">
                  {dispatcherIndex + 1} de {dispatcherQueue.length}
                </Badge>
              </div>
              <Progress value={((dispatcherIndex + 1) / dispatcherQueue.length) * 100} className="h-2 bg-white/20" />
            </div>

            <div className="p-6 space-y-6 bg-background">
              {dispatcherQueue[dispatcherIndex] && (
                <>
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border">
                    <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="size-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg">{dispatcherQueue[dispatcherIndex].name}</h4>
                      <p className="text-muted-foreground text-sm">{dispatcherQueue[dispatcherIndex].phone}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Pré-visualização da Mensagem</Label>
                    <div className="p-4 rounded-xl bg-muted/20 border text-sm italic whitespace-pre-wrap leading-relaxed">
                      {getFormattedMessage(dispatcherQueue[dispatcherIndex], !dispatcherQueue[dispatcherIndex].lastContact)}
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button variant="outline" className="w-full" onClick={advanceQueue}>
                  <SkipForward className="size-4 mr-2" /> Pular
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setIsDispatcherOpen(false)}>
                  <StopCircle className="size-4 mr-2" /> Encerrar
                </Button>
              </div>
              
              <Button 
                className="w-full h-14 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
                onClick={handleQueueSend}
              >
                Abrir WhatsApp e Avançar <ChevronRight className="size-5 ml-2" />
              </Button>
            </div>
          </Card>
        </DialogContent>
      </Dialog>
      
      <footer className="max-w-5xl mx-auto mt-20 pt-8 border-t text-center text-xs text-muted-foreground">
        <p>Desenvolvido pela AJP Entretenimento • Gemini Vision AI</p>
      </footer>
    </div>
    </TooltipProvider>
  );
}
