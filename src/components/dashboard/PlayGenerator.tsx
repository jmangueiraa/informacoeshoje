import React, { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, 
  Upload, 
  Download, 
  Trash2, 
  Layout, 
  Palette,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Settings as SettingsIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { savePlayAsset, getPlayAssets, deletePlayAsset } from '@/lib/play-generator.functions';

interface PlayStyle {
  id: string;
  name: string;
  bgColor: string;
  iconColor: string;
  border: boolean;
  shadow: boolean;
}

const PLAY_STYLES: PlayStyle[] = [
  { id: 'default', name: 'Padrão', bgColor: 'rgba(0,0,0,0.5)', iconColor: '#ffffff', border: true, shadow: true },
  { id: 'white', name: 'Branco + Preto', bgColor: '#ffffff', iconColor: '#000000', border: true, shadow: true },
  { id: 'red', name: 'Vermelho + Branco', bgColor: '#ff0000', iconColor: '#ffffff', border: false, shadow: true },
  { id: 'transparent', name: 'Semitransparente', bgColor: 'rgba(255,255,255,0.3)', iconColor: '#ffffff', border: true, shadow: false },
  { id: 'minimalist', name: 'Minimalista', bgColor: 'transparent', iconColor: '#ffffff', border: true, shadow: false },
  { id: 'modern', name: 'Moderno', bgColor: 'rgba(0,0,0,0.8)', iconColor: '#ffffff', border: false, shadow: true },
];

export function PlayGenerator() {
  const [image, setImage] = useState<string | null>(null);
  const [playPos, setPlayPos] = useState({ x: 50, y: 50 });
  const [size, setSize] = useState(100);
  const [opacity, setOpacity] = useState(80);
  const [style, setStyle] = useState<PlayStyle>(PLAY_STYLES[0]);
  const [quality, setQuality] = useState(90);
  const [format, setFormat] = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const queryClient = useQueryClient();

  const { data: assets, isLoading: isLoadingAssets } = useQuery({
    queryKey: ['play-assets'],
    queryFn: () => getPlayAssets(),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => savePlayAsset({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['play-assets'] });
      toast.success("Imagem gerada e salva com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar no histórico: " + err.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePlayAsset({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['play-assets'] });
      toast.success("Item removido do histórico.");
    }
  });

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setImage(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleDrag = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    let x = ((clientX - rect.left) / rect.width) * 100;
    let y = ((clientY - rect.top) / rect.height) * 100;
    
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));
    
    setPlayPos({ x, y });
  };

  const generateImage = async () => {
    if (!image || !canvasRef.current) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = image;
    
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    const canvas = canvasRef.current;
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);

    const scale = img.width / (containerRef.current?.offsetWidth || 500);
    const playSize = (size / 2) * scale;
    const centerX = (playPos.x / 100) * img.width;
    const centerY = (playPos.y / 100) * img.height;

    ctx.save();
    ctx.globalAlpha = opacity / 100;
    
    if (style.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 15 * scale;
      ctx.shadowOffsetX = 5 * scale;
      ctx.shadowOffsetY = 5 * scale;
    }

    ctx.beginPath();
    ctx.arc(centerX, centerY, playSize, 0, Math.PI * 2);
    ctx.fillStyle = style.bgColor;
    ctx.fill();

    if (style.border) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4 * scale;
      ctx.stroke();
    }

    const triangleSize = playSize * 0.4;
    ctx.beginPath();
    ctx.moveTo(centerX + triangleSize, centerY);
    ctx.lineTo(centerX - triangleSize / 2, centerY - triangleSize * 0.866);
    ctx.lineTo(centerX - triangleSize / 2, centerY + triangleSize * 0.866);
    ctx.closePath();
    ctx.fillStyle = style.iconColor;
    ctx.fill();

    ctx.restore();

    const finalDataUrl = canvas.toDataURL(format, quality / 100);
    
    const downloadLink = document.createElement('a');
    downloadLink.download = `shopee-play-${Date.now()}.${format.split('/')[1]}`;
    downloadLink.href = finalDataUrl;
    downloadLink.click();

    try {
      saveMutation.mutate({
        originalUrl: image.substring(0, 50),
        finalUrl: finalDataUrl.substring(0, 50),
        settings: { playPos, size, opacity, styleId: style.id, quality, format }
      });
    } catch (e) {
      console.error(e);
    }
  };

  const quickPosition = (pos: string) => {
    switch(pos) {
      case 'center': setPlayPos({ x: 50, y: 50 }); break;
      case 'tl': setPlayPos({ x: 15, y: 15 }); break;
      case 'tr': setPlayPos({ x: 85, y: 15 }); break;
      case 'bl': setPlayPos({ x: 15, y: 85 }); break;
      case 'br': setPlayPos({ x: 85, y: 85 }); break;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-4 space-y-6 order-2 lg:order-1">
        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="style">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="style"><Palette className="h-4 w-4 mr-2" /> Estilo</TabsTrigger>
                <TabsTrigger value="layout"><Layout className="h-4 w-4 mr-2" /> Layout</TabsTrigger>
                <TabsTrigger value="config"><SettingsIcon className="h-4 w-4 mr-2" /> Export</TabsTrigger>
              </TabsList>

              <TabsContent value="style" className="space-y-4">
                <div className="space-y-2">
                  <Label>Estilo do Play</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {PLAY_STYLES.map((s) => (
                      <Button 
                        key={s.id} 
                        variant={style.id === s.id ? "default" : "outline"}
                        className="text-xs h-auto py-2 px-1 flex flex-col gap-1"
                        onClick={() => setStyle(s)}
                      >
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center border"
                          style={{ backgroundColor: s.bgColor }}
                        >
                          <Play className="h-3 w-3 fill-current" style={{ color: s.iconColor }} />
                        </div>
                        {s.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Opacidade</Label>
                    <span className="text-xs text-muted-foreground">{opacity}%</span>
                  </div>
                  <Slider 
                    value={[opacity]} 
                    onValueChange={(vals) => setOpacity(vals[0] ?? 80)} 
                    max={100} 
                    step={1} 
                  />
                </div>
              </TabsContent>

              <TabsContent value="layout" className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Tamanho do Botão</Label>
                    <span className="text-xs text-muted-foreground">{size}px</span>
                  </div>
                  <Slider 
                    value={[size]} 
                    onValueChange={(vals) => setSize(vals[0] ?? 100)} 
                    min={40}
                    max={300} 
                    step={1} 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Posição Rápida</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="outline" size="sm" onClick={() => quickPosition('tl')}><ChevronLeft className="h-4 w-4" /><ChevronUp className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => quickPosition('center')}><CircleDot className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => quickPosition('tr')}><ChevronRight className="h-4 w-4" /><ChevronUp className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => quickPosition('bl')}><ChevronLeft className="h-4 w-4" /><ChevronDown className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => quickPosition('br')}><ChevronRight className="h-4 w-4" /><ChevronDown className="h-4 w-4" /></Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="config" className="space-y-4">
                <div className="space-y-2">
                  <Label>Formato de Saída</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant={format === 'image/jpeg' ? 'default' : 'outline'} size="sm" onClick={() => setFormat('image/jpeg')}>JPG</Button>
                    <Button variant={format === 'image/png' ? 'default' : 'outline'} size="sm" onClick={() => setFormat('image/png')}>PNG</Button>
                    <Button variant={format === 'image/webp' ? 'default' : 'outline'} size="sm" onClick={() => setFormat('image/webp')}>WEBP</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Qualidade</Label>
                    <span className="text-xs text-muted-foreground">{quality}%</span>
                  </div>
                  <Slider 
                    value={[quality]} 
                    onValueChange={(vals) => setQuality(vals[0] ?? 90)} 
                    min={10}
                    max={100} 
                    step={1} 
                  />
                </div>
              </TabsContent>
            </Tabs>

            <Button className="w-full mt-6 gap-2" size="lg" onClick={generateImage} disabled={!image}>
              <Download className="h-4 w-4" />
              GERAR E BAIXAR IMAGEM
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <Label className="text-lg font-bold">Histórico Recente</Label>
          <div className="space-y-2">
            {isLoadingAssets ? (
              <div className="text-center py-4 text-muted-foreground text-sm">Carregando...</div>
            ) : !assets || assets.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">Nenhuma imagem gerada ainda.</div>
            ) : (
              assets.slice(0, 5).map((asset: any) => (
                <div key={asset.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg border text-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-black rounded flex items-center justify-center overflow-hidden">
                      <Play className="h-4 w-4 text-white fill-current opacity-50" />
                    </div>
                    <div>
                      <div className="font-medium truncate max-w-[120px]">Imagem {new Date(asset.created_at).toLocaleDateString()}</div>
                      <div className="text-[10px] text-muted-foreground">{asset.settings?.format?.split('/')[1]?.toUpperCase() || 'JPG'}</div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => deleteMutation.mutate(asset.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-8 space-y-4 order-1 lg:order-2">
        {!image ? (
          <div className="aspect-video w-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center bg-muted/20 gap-4 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Arraste sua imagem aqui</h3>
              <p className="text-muted-foreground max-w-xs mx-auto">Suporta JPG, PNG e WEBP. Resolução original preservada.</p>
            </div>
            <Input 
              type="file" 
              accept="image/*" 
              className="max-w-[200px]" 
              onChange={handleUpload}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div 
              ref={containerRef}
              className="relative w-full aspect-auto rounded-xl overflow-hidden shadow-2xl bg-black/5 cursor-crosshair select-none touch-none"
              onMouseDown={handleDrag}
              onMouseMove={(e) => e.buttons === 1 && handleDrag(e)}
              onTouchMove={handleDrag}
            >
              <img 
                src={image} 
                alt="Preview" 
                className="w-full h-auto"
                draggable={false}
              />
              
              <div 
                className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ 
                  left: `${playPos.x}%`, 
                  top: `${playPos.y}%`,
                  width: `${size}px`,
                  height: `${size}px`,
                  opacity: opacity / 100
                }}
              >
                <div 
                  className="w-full h-full rounded-full flex items-center justify-center border-white/80"
                  style={{ 
                    backgroundColor: style.bgColor,
                    borderWidth: style.border ? '4px' : '0px',
                    boxShadow: style.shadow ? '0 10px 25px rgba(0,0,0,0.5)' : 'none'
                  }}
                >
                  <Play 
                    className="w-1/2 h-1/2 fill-current" 
                    style={{ color: style.iconColor }}
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center bg-muted/30 p-4 rounded-lg">
              <div className="text-sm text-muted-foreground">
                <span className="font-bold text-foreground">Dica:</span> Clique ou arraste o botão Play para posicioná-lo.
              </div>
              <Button variant="outline" size="sm" onClick={() => setImage(null)}>
                Trocar Imagem
              </Button>
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
