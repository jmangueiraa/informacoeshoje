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
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { extractContactsWithAI, extractContactsWithVision } from "@/lib/ocr-contacts.functions";
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

function Index() {
  const [images, setImages] = useState<OCRImage[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [overallStatus, setOverallStatus] = useState("");
  const [userApiKey, setUserApiKey] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [clientCounter, setClientCounter] = useState(1);
  const [extractedContacts, setExtractedContacts] = useState<(Contact & { 
    id: string; 
    imgId?: string; 
    fileName?: string; 
    preview?: string;
    contactIdx?: number;
  })[]>([]);
  
  const extractWithAI = useServerFn(extractContactsWithAI);
  const extractWithVision = useServerFn(extractContactsWithVision);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1] || "";
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  useEffect(() => {
    const savedKey = localStorage.getItem("fototext_api_key");
    if (savedKey) setUserApiKey(savedKey);
    
    // Load contacts from localStorage
    const savedContacts = localStorage.getItem("linkafiliado_contacts_storage");
    if (savedContacts) {
      try {
        setExtractedContacts(JSON.parse(savedContacts));
      } catch (e) {
        console.error("Erro ao carregar contatos do localStorage", e);
      }
    }
    
    // Load counter
    const savedCounter = localStorage.getItem("linkafiliado_client_counter");
    if (savedCounter) setClientCounter(parseInt(savedCounter, 10));
  }, []);

  // Sync contacts to localStorage
  useEffect(() => {
    localStorage.setItem("linkafiliado_contacts_storage", JSON.stringify(extractedContacts));
  }, [extractedContacts]);

  // Sync counter to localStorage
  useEffect(() => {
    localStorage.setItem("linkafiliado_client_counter", clientCounter.toString());
  }, [clientCounter]);

  const saveSettings = (key: string) => {
    localStorage.setItem("fototext_api_key", key);
    setUserApiKey(key);
    setIsSettingsOpen(false);
    toast.success("Configurações salvas!");
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

    if (!userApiKey) {
      toast.error("API Key não configurada! Vá em configurações.");
      setIsSettingsOpen(true);
      return;
    }

    setLoading(true);
    setOverallStatus("Iniciando processamento...");

    const imagesToProcess = [...images];
    for (let i = 0; i < imagesToProcess.length; i++) {
      const currentImage = imagesToProcess[i];
      if (!currentImage || (currentImage.status !== "pending" && currentImage.status !== "error")) continue;

      const currentId = currentImage.id;
      setImages((prev) =>
        prev.map((img) => (img.id === currentId ? { ...img, status: "processing" } : img))
      );
      setOverallStatus(`Processando ${i + 1} de ${imagesToProcess.length} imagens com Vision...`);

      try {
        const base64 = await fileToBase64(currentImage.file);
        
        const result = await extractWithVision({ 
          data: { 
            base64Image: base64,
            mimeType: currentImage.file.type || "image/png",
            userApiKey,
            clientIndex: clientCounter - 1
          } 
        });

        const name = result.primeiro_nome || `Cliente ${String(clientCounter).padStart(5, '0')}`;
        const contact = {
          name,
          phone: result.contato || "Não encontrado"
        };

        if (name.startsWith("Cliente")) {
          setClientCounter(prev => prev + 1);
        }

        setExtractedContacts(prev => [...prev, {
          ...contact,
          id: Math.random().toString(36).substring(7),
          imgId: currentId,
          fileName: currentImage.file.name,
          preview: currentImage.preview,
          contactIdx: 0
        }]);

        setImages((prev) =>
          prev.map((img) =>
            img.id === currentId ? { ...img, status: "completed", text: `Extraído via Vision: ${name}`, contacts: [contact], progress: 100 } : img
          )
        );
      } catch (err) {
        console.error(err);
        setImages((prev) =>
          prev.map((img) =>
            img.id === currentId ? { ...img, status: "error", error: "Erro na Vision API" } : img
          )
        );
        toast.error(`Erro ao processar imagem ${i + 1}`);
      }
    }

    setLoading(false);
    setOverallStatus("Processamento concluído!");
    toast.success("Batch processado com sucesso!");
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
    setExtractedContacts(prev => prev.map(c => {
      if (c.id === contactId) {
        return { ...c, [field]: value };
      }
      return c;
    }));
  };

  const allContacts = extractedContacts;

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
                  <DialogTitle>Configurações de IA</DialogTitle>
                  <DialogDescription>
                    Insira sua chave de API para habilitar a extração inteligente de contatos. 
                    A chave será salva apenas no seu navegador.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="apiKey">Chave de API (Groq/OpenAI/Lovable)</Label>
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
          <p className="text-muted-foreground text-lg">Extração inteligente de contatos da Shopee via Gemini Vision AI</p>
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
              
              <ScrollArea className="h-[400px] rounded-md border p-4 bg-muted/30">
                {images.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2 opacity-50">
                    <Clock className="size-8" />
                    <p className="text-sm">Nenhuma imagem na fila</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {images.map((img) => (
                      <div key={img.id} className="bg-background rounded-lg border p-3 flex gap-3 relative group">
                        <div className="size-12 rounded bg-muted overflow-hidden shrink-0 border">
                          <img src={img.preview} alt="Preview" className="size-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-xs font-medium truncate pr-6">{img.file.name}</p>
                          <div className="flex items-center gap-2">
                            {img.status === 'pending' && <Badge variant="secondary" className="text-[10px] py-0">Pendente</Badge>}
                            {img.status === 'processing' && (
                              <div className="flex-1 space-y-1">
                                <Badge className="text-[10px] py-0 bg-blue-500 hover:bg-blue-500 flex items-center gap-1">
                                  {overallStatus.includes("Analisando") ? <Sparkles className="size-2 animate-pulse" /> : null}
                                  {overallStatus.includes("Analisando") ? "Analisando" : "Processando"}
                                </Badge>
                                <Progress value={img.progress} className="h-1" />
                              </div>
                            )}
                            {img.status === 'completed' && <Badge className="text-[10px] py-0 bg-emerald-500 hover:bg-emerald-500">Concluído</Badge>}
                            {img.status === 'error' && <Badge variant="destructive" className="text-[10px] py-0">Erro</Badge>}
                          </div>
                        </div>
                        <button 
                          onClick={() => removeImage(img.id)}
                          disabled={loading}
                          className="absolute top-2 right-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <div className="flex gap-3">
                <Button className="flex-1" onClick={processOCR} disabled={loading || images.length === 0 || images.every(i => i.status === 'completed')}>
                  {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : "Iniciar Batch"}
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
                    <div className="flex justify-between items-center">
                      <Button variant="ghost" size="sm" onClick={clearContacts} disabled={loading} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="size-3 mr-2" /> Limpar Contatos
                      </Button>
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
                              <TableHead className="w-[60px]">Imagem</TableHead>
                              <TableHead>Primeiro Nome</TableHead>
                              <TableHead>Contato</TableHead>
                              <TableHead className="text-right w-[150px]">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {allContacts.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                  Nenhum contato identificado. Comece processando imagens.
                                </TableCell>
                              </TableRow>
                            ) : (
                              allContacts.map((contact) => (
                                <TableRow key={contact.id}>
                                  <TableCell>
                                    <div className="size-10 rounded overflow-hidden border bg-muted">
                                      {contact.preview ? (
                                        <img src={contact.preview} alt="Preview" className="size-full object-cover" />
                                      ) : (
                                        <div className="size-full flex items-center justify-center">
                                          <FileText className="size-4 text-muted-foreground" />
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
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
                                      <Button 
                                        variant="outline" 
                                        size="icon" 
                                        className="size-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                        title="Abrir WhatsApp"
                                        onClick={() => {
                                          const cleanPhone = contact.phone.replace(/\D/g, "");
                                          const phoneWithCountry = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
                                          window.open(`https://wa.me/${phoneWithCountry}`, "_blank");
                                        }}
                                      >
                                        <div className="size-3 flex items-center justify-center">
                                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                        </div>
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
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
      
      <footer className="max-w-5xl mx-auto mt-20 pt-8 border-t text-center text-xs text-muted-foreground">
        <p>Fototext © 2024 • Processamento Inteligente • Gemini Vision AI</p>
      </footer>
    </div>
  );
}
