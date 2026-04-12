import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { Upload, Image as ImageIcon, Loader2, PenTool, Eye, EyeOff, CheckCircle2, Circle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface ImageDimensions {
  width: number;
  height: number;
}

interface TextAnnotation {
  x: number;
  y: number;
  text: string;
  category: 'perspective' | 'anatomy' | 'composition' | 'linework' | 'general';
  anchor?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

interface CorrectionResult {
  redLinesOverlay: string | null;
  annotations: TextAnnotation[];
  summaryText: string | null;
}

function getImageDimensions(dataUrl: string): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function resizeImageToMatch(sourceDataUrl: string, targetDims: ImageDimensions): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetDims.width;
      canvas.height = targetDims.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, targetDims.width, targetDims.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = sourceDataUrl;
  });
}

function extractRedLines(originalDataUrl: string, correctedDataUrl: string, dims: ImageDimensions): Promise<string> {
  return new Promise((resolve, reject) => {
    const origImg = new Image();
    const corrImg = new Image();
    let loaded = 0;

    const onBothLoaded = () => {
      const origCanvas = document.createElement('canvas');
      origCanvas.width = dims.width;
      origCanvas.height = dims.height;
      const origCtx = origCanvas.getContext('2d')!;
      origCtx.drawImage(origImg, 0, 0, dims.width, dims.height);
      const origData = origCtx.getImageData(0, 0, dims.width, dims.height);

      const corrCanvas = document.createElement('canvas');
      corrCanvas.width = dims.width;
      corrCanvas.height = dims.height;
      const corrCtx = corrCanvas.getContext('2d')!;
      corrCtx.drawImage(corrImg, 0, 0, dims.width, dims.height);
      const corrData = corrCtx.getImageData(0, 0, dims.width, dims.height);

      const outCanvas = document.createElement('canvas');
      outCanvas.width = dims.width;
      outCanvas.height = dims.height;
      const outCtx = outCanvas.getContext('2d')!;
      const outData = outCtx.createImageData(dims.width, dims.height);

      for (let i = 0; i < origData.data.length; i += 4) {
        const oR = origData.data[i], oG = origData.data[i + 1], oB = origData.data[i + 2];
        const cR = corrData.data[i], cG = corrData.data[i + 1], cB = corrData.data[i + 2];

        const diffR = Math.abs(cR - oR);
        const diffG = Math.abs(cG - oG);
        const diffB = Math.abs(cB - oB);
        const totalDiff = diffR + diffG + diffB;

        const isReddish = cR > 120 && cR > cG * 1.3 && cR > cB * 1.3;
        const isSignificantDiff = totalDiff > 80;

        if (isReddish && isSignificantDiff) {
          outData.data[i] = cR;
          outData.data[i + 1] = cG;
          outData.data[i + 2] = cB;
          outData.data[i + 3] = Math.min(255, totalDiff * 2);
        } else {
          outData.data[i + 3] = 0;
        }
      }

      outCtx.putImageData(outData, 0, 0);
      resolve(outCanvas.toDataURL('image/png'));
    };

    origImg.onload = () => { loaded++; if (loaded === 2) onBothLoaded(); };
    corrImg.onload = () => { loaded++; if (loaded === 2) onBothLoaded(); };
    origImg.onerror = reject;
    corrImg.onerror = reject;
    origImg.src = originalDataUrl;
    corrImg.src = correctedDataUrl;
  });
}

const CATEGORY_STYLES: Record<TextAnnotation['category'], { bg: string; border: string; text: string; label: string }> = {
  perspective: { bg: 'bg-red-50/95', border: 'border-red-400', text: 'text-red-700', label: 'パース' },
  anatomy: { bg: 'bg-orange-50/95', border: 'border-orange-400', text: 'text-orange-700', label: '人体構造' },
  composition: { bg: 'bg-blue-50/95', border: 'border-blue-400', text: 'text-blue-700', label: '構図' },
  linework: { bg: 'bg-purple-50/95', border: 'border-purple-400', text: 'text-purple-700', label: '線画' },
  general: { bg: 'bg-emerald-50/95', border: 'border-emerald-400', text: 'text-emerald-700', label: '全般' },
};

export default function App() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [showRedLines, setShowRedLines] = useState(true);
  const [expandedAnnotations, setExpandedAnnotations] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const LOADING_STEPS = [
    { label: '画像を分析中', desc: '作品の構図・人体構造を読み取っています' },
    { label: '赤ペン修正を生成中', desc: 'プロの視点で修正線を描いています' },
    { label: '修正線を抽出中', desc: '元画像に重ねる赤ペンレイヤーを作成しています' },
    { label: 'テキスト注釈を生成中', desc: '修正箇所に対するアドバイスを作成しています' },
    { label: '完了', desc: '' },
  ];

  const TIPS = [
    '💡 人体を描くときは、まず大きなシルエットから捉えましょう',
    '💡 パースの基本は「消失点」。目線の高さを意識すると安定します',
    '💡 線画は「入り」と「抜き」を意識すると、生き生きとした線になります',
    '💡 関節の位置を正確に取ると、ポーズに説得力が出ます',
    '💡 構図に迷ったら「三分割法」を試してみましょう',
    '💡 手を描くコツ：まずミトンのような塊として捉えてから指を描く',
    '💡 布のシワは、力がかかる点（支点）と重力を意識すると自然になります',
    '💡 影をつけるとき、光源の位置を先に決めると統一感が出ます',
  ];

  useEffect(() => {
    if (!loadingStartTime) { setElapsed(0); return; }
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - loadingStartTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [loadingStartTime]);

  const currentTip = TIPS[Math.floor(elapsed / 5) % TIPS.length];

  const toggleAnnotation = (index: number) => {
    setExpandedAnnotations(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (result) {
      setExpandedAnnotations(new Set(result.annotations.map((_, i) => i)));
    }
  };

  const collapseAll = () => {
    setExpandedAnnotations(new Set());
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
      setResult(null);
      setError(null);
      setExpandedAnnotations(new Set());
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
      setResult(null);
      setError(null);
      setExpandedAnnotations(new Set());
    }
  };

  const generateImageCorrection = useCallback(async (base64Data: string, mimeType: string, dims: ImageDimensions): Promise<string | null> => {
    const prompt = `あなたはプロの漫画家・イラストレーターの講師です。
生徒が描いたイラスト（または漫画のコマ）がアップロードされました。
元画像のサイズは ${dims.width}×${dims.height} ピクセルです。

【重要な指示】
- 元の絵の上に「赤い修正線」のみを描き込んでください
- 文字やテキストは一切書き込まないでください
- 修正線は赤色で、パースライン、人体構造の修正、構図のガイドラインなどを描いてください
- 元の絵をできるだけ残し、修正が必要な部分に赤い線を重ねてください
- テキスト注釈は別途生成するので、画像には絶対に文字を入れないでください
- 出力画像は元画像とまったく同じアスペクト比・解像度にしてください`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: prompt },
        ],
      },
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  }, []);

  const generateTextAnnotations = useCallback(async (
    originalBase64: string,
    originalMimeType: string,
    correctedDataUrl: string | null,
    dims: ImageDimensions,
  ): Promise<{ annotations: TextAnnotation[]; summary: string }> => {
    const parts: Array<{ inlineData: { data: string; mimeType: string } } | { text: string }> = [];

    if (correctedDataUrl) {
      const correctedBase64 = correctedDataUrl.split(',')[1];
      const correctedMime = correctedDataUrl.split(';')[0].split(':')[1];
      parts.push({
        inlineData: { data: correctedBase64, mimeType: correctedMime },
      });
    }

    parts.push({
      inlineData: { data: originalBase64, mimeType: originalMimeType },
    });

    const prompt = correctedDataUrl
      ? `あなたはプロの漫画家・イラストレーターの講師です。

添付画像について:
- 1枚目: 赤ペンで修正線を入れた添削済み画像（この画像の座標を使ってください）
- 2枚目: 生徒の元の絵（参考用）

添削済み画像（1枚目）のサイズ: ${dims.width} × ${dims.height} ピクセル

【タスク】
添削済み画像（1枚目）に描かれている赤い修正線の位置に、注釈テキストをピクセル座標付きで配置してください。

【座標指定の手順 — 必ずこの手順に従ってください】
1. 添削済み画像（1枚目）だけを見てください
2. 赤い修正線が描かれている箇所を特定してください
3. その赤い線の中心のピクセル座標を読み取ってください
4. px = 左端から何ピクセル右か（0〜${dims.width}）
5. py = 上端から何ピクセル下か（0〜${dims.height}）

【具体例で確認】
- 画像の左上角 = (px: 0, py: 0)
- 画像の中央 = (px: ${Math.round(dims.width / 2)}, py: ${Math.round(dims.height / 2)})
- 画像の右下角 = (px: ${dims.width}, py: ${dims.height})

以下のJSON形式で回答してください。他のテキストは含めないでください。

{
  "annotations": [
    {
      "px": ${Math.round(dims.width / 2)},
      "py": ${Math.round(dims.height / 4)},
      "text": "この赤い修正線についてのアドバイス",
      "category": "anatomy"
    }
  ],
  "summary": "全体的な講評"
}

フィールド説明:
- px: 赤い修正線の中心の水平ピクセル座標（0=左端, ${dims.width}=右端）
- py: 赤い修正線の中心の垂直ピクセル座標（0=上端, ${dims.height}=下端）
- text: その修正箇所に対する具体的なアドバイス（日本語、50文字以内）
- category: "perspective" / "anatomy" / "composition" / "linework" / "general"
- summary: 全体的な講評（マークダウン形式、励ましの言葉も含めて）

注意:
- annotationsは3〜8個
- px,pyは必ず添削済み画像（1枚目）上の赤い線の位置を正確に指定してください
- 具体的で実践的なアドバイスを書いてください`
      : `あなたはプロの漫画家・イラストレーターの講師です。
生徒が描いたイラスト（または漫画のコマ）です。

画像サイズ: ${dims.width} × ${dims.height} ピクセル

修正が必要な箇所に注釈テキストをピクセル座標付きで配置してください。

以下のJSON形式で回答してください。

{
  "annotations": [
    {
      "px": ${Math.round(dims.width / 2)},
      "py": ${Math.round(dims.height / 4)},
      "text": "修正アドバイス",
      "category": "anatomy"
    }
  ],
  "summary": "全体的な講評"
}

- px: 水平ピクセル座標（0〜${dims.width}）
- py: 垂直ピクセル座標（0〜${dims.height}）
- text: アドバイス（日本語、50文字以内）
- category: "perspective" / "anatomy" / "composition" / "linework" / "general"
- summary: 全体的な講評（マークダウン形式）
- annotationsは3〜8個`;

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.candidates?.[0]?.content?.parts
      ?.filter((p: { text?: string }) => p.text)
      .map((p: { text?: string }) => p.text)
      .join('') || '';
    if (!rawText) throw new Error('No text response from annotation model');

    const parsed = JSON.parse(rawText);
    return {
      annotations: (parsed.annotations || []).map((a: { px: number; py: number; text: string; category: TextAnnotation['category']; anchor?: TextAnnotation['anchor'] }) => {
        const xPct = Math.max(0, Math.min(100, (a.px / dims.width) * 100));
        const yPct = Math.max(0, Math.min(100, (a.py / dims.height) * 100));
        const anchor = xPct > 70
          ? (yPct > 70 ? 'bottom-right' : 'top-right')
          : (yPct > 70 ? 'bottom-left' : 'top-left');
        return {
          x: xPct,
          y: yPct,
          text: a.text,
          category: a.category || 'general',
          anchor: a.anchor || anchor,
        };
      }),
      summary: parsed.summary || '',
    };
  }, []);

  const generateFeedback = async () => {
    if (!selectedImage || !imagePreview) return;

    setIsLoading(true);
    setLoadingStep(0);
    setLoadingStartTime(Date.now());
    setError(null);
    setResult(null);
    setExpandedAnnotations(new Set());

    const base64Data = imagePreview.split(',')[1];
    const mimeType = selectedImage.type;

    try {
      // Step 0: Analyzing
      const originalDims = await getImageDimensions(imagePreview);

      // Step 1: Generating red-pen corrections
      setLoadingStep(1);
      let correctedImageUrl: string | null = null;
      let redLinesOverlay: string | null = null;
      try {
        const rawCorrected = await generateImageCorrection(base64Data, mimeType, originalDims);
        if (rawCorrected) {
          // Step 2: Extracting red lines
          setLoadingStep(2);
          const correctedDims = await getImageDimensions(rawCorrected);
          if (correctedDims.width !== originalDims.width || correctedDims.height !== originalDims.height) {
            correctedImageUrl = await resizeImageToMatch(rawCorrected, originalDims);
          } else {
            correctedImageUrl = rawCorrected;
          }
          redLinesOverlay = await extractRedLines(imagePreview, correctedImageUrl, originalDims);
        }
      } catch (imgErr) {
        console.error('Image generation failed, continuing with text only:', imgErr);
      }

      if (redLinesOverlay) {
        setResult({
          redLinesOverlay,
          annotations: [],
          summaryText: null,
        });
      }

      // Step 3: Generating text annotations
      setLoadingStep(3);
      let annotationResult: { annotations: TextAnnotation[]; summary: string } | null = null;
      try {
        annotationResult = await generateTextAnnotations(base64Data, mimeType, correctedImageUrl, originalDims);
      } catch (textErr) {
        console.error('Text annotation generation failed:', textErr);
      }

      if (!redLinesOverlay && !annotationResult) {
        setError('添削結果の生成に失敗しました。もう一度お試しください。');
        return;
      }

      // Step 4: Done
      setLoadingStep(4);
      const annotations = annotationResult?.annotations || [];
      setResult({
        redLinesOverlay,
        annotations,
        summaryText: annotationResult?.summary || null,
      });
      setExpandedAnnotations(new Set(annotations.map((_, i) => i)));
    } catch (err) {
      console.error('Error generating feedback:', err);
      setError('エラーが発生しました。APIキーやネットワーク接続を確認してください。');
    } finally {
      setIsLoading(false);
      setLoadingStartTime(null);
    }
  };

  const getAnnotationPosition = (annotation: TextAnnotation): React.CSSProperties => {
    const x = Math.max(2, Math.min(98, annotation.x));
    const y = Math.max(2, Math.min(98, annotation.y));

    const style: React.CSSProperties = {
      position: 'absolute',
      top: `${y}%`,
    };

    // For horizontal placement: if the point is in the right 55% of the image,
    // anchor from the right edge so the bubble expands leftward.
    if (x > 55) {
      style.right = `${100 - x}%`;
      style.transform = y > 75 ? 'translateY(-100%)' : undefined;
    } else {
      style.left = `${x}%`;
      style.transform = y > 75 ? 'translateY(-100%)' : undefined;
    }

    return style;
  };

  const hasResult = result && (result.redLinesOverlay || result.annotations.length > 0);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-red-100 rounded-full mb-4">
            <PenTool className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">漫画塾 AI添削システム</h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            あなたのイラストや漫画のコマをアップロードしてください。プロの講師視点で、パースや人体構造などの具体的なアドバイスを提供します。
          </p>
        </header>

        <div className="grid lg:grid-cols-3 gap-8">
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle>作品のアップロード</CardTitle>
              <CardDescription>添削してほしい画像をアップロード</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                  imagePreview ? 'border-slate-200 bg-slate-50' : 'border-slate-300 hover:border-red-400 hover:bg-red-50'
                }`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => !imagePreview && fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  accept="image/*"
                  className="hidden"
                />
                {imagePreview ? (
                  <div className="relative group">
                    <img src={imagePreview} alt="Preview" className="max-h-[250px] mx-auto rounded-lg shadow-sm object-contain" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                      <Button variant="secondary" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                        画像を変更
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-3 py-8">
                    <div className="p-3 bg-white rounded-full shadow-sm">
                      <Upload className="w-6 h-6 text-slate-400" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-700">クリックまたはドラッグ＆ドロップで画像を選択</p>
                      <p className="text-xs text-slate-500">PNG, JPG, WEBP (最大 10MB)</p>
                    </div>
                  </div>
                )}
              </div>

              <Button
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                size="lg"
                disabled={!selectedImage || isLoading}
                onClick={generateFeedback}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {LOADING_STEPS[loadingStep]?.label || '処理中...'}
                  </>
                ) : (
                  <>
                    <PenTool className="w-5 h-5 mr-2" />
                    AIに添削を依頼する
                  </>
                )}
              </Button>

              {hasResult && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {result.redLinesOverlay && (
                      <Button
                        variant={showRedLines ? 'default' : 'outline'}
                        size="sm"
                        className={`h-7 px-2.5 text-xs ${showRedLines ? 'bg-red-600 hover:bg-red-700' : ''}`}
                        onClick={() => setShowRedLines(!showRedLines)}
                      >
                        {showRedLines ? <Eye className="w-3.5 h-3.5 mr-1" /> : <EyeOff className="w-3.5 h-3.5 mr-1" />}
                        赤ペン
                      </Button>
                    )}
                    {result.annotations.length > 0 && (
                      <>
                        <Button
                          variant={showAnnotations ? 'default' : 'outline'}
                          size="sm"
                          className={`h-7 px-2.5 text-xs ${showAnnotations ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
                          onClick={() => setShowAnnotations(!showAnnotations)}
                        >
                          {showAnnotations ? <Eye className="w-3.5 h-3.5 mr-1" /> : <EyeOff className="w-3.5 h-3.5 mr-1" />}
                          注釈
                        </Button>
                        {showAnnotations && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-xs"
                            onClick={() => expandedAnnotations.size > 0 ? collapseAll() : expandAll()}
                          >
                            {expandedAnnotations.size > 0 ? '全て閉じる' : '全て開く'}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {result.annotations.map((ann, i) => {
                      const style = CATEGORY_STYLES[ann.category];
                      const isExpanded = expandedAnnotations.has(i);
                      return (
                        <button
                          key={i}
                          className={`w-full text-left p-2 rounded-lg border text-xs transition-all ${style.bg} ${style.border} ${style.text} ${
                            isExpanded ? 'ring-2 ring-offset-1 ring-slate-400 shadow-sm' : 'opacity-70 hover:opacity-100'
                          }`}
                          onClick={() => toggleAnnotation(i)}
                        >
                          <span className="font-semibold mr-1.5">{i + 1}.</span>
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/60 mr-1.5">{style.label}</span>
                          {isExpanded ? ann.text : <span className="text-slate-400">タップで表示</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200 lg:col-span-2 flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center">
                <ImageIcon className="w-5 h-5 mr-2 text-slate-500" />
                添削結果
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden flex flex-col">
              {error ? (
                <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
              ) : isLoading ? (
                <div className="flex-1 flex flex-col justify-center min-h-[400px] space-y-8 px-4">
                  {/* Progress steps */}
                  <div className="space-y-3">
                    {LOADING_STEPS.slice(0, -1).map((step, i) => {
                      const isDone = loadingStep > i;
                      const isActive = loadingStep === i;
                      return (
                        <div key={i} className={`flex items-start gap-3 transition-opacity duration-300 ${isDone || isActive ? 'opacity-100' : 'opacity-30'}`}>
                          <div className="mt-0.5 shrink-0">
                            {isDone ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : isActive ? (
                              <Loader2 className="w-5 h-5 text-red-500 animate-spin" />
                            ) : (
                              <Circle className="w-5 h-5 text-slate-300" />
                            )}
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${isActive ? 'text-slate-900' : isDone ? 'text-slate-500' : 'text-slate-400'}`}>
                              {step.label}
                            </p>
                            {isActive && (
                              <p className="text-xs text-slate-500 mt-0.5">{step.desc}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Elapsed time */}
                  <div className="text-center text-xs text-slate-400">
                    経過時間: {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
                  </div>

                  {/* Rotating tip */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center transition-all">
                    <p className="text-xs text-amber-700 leading-relaxed">{currentTip}</p>
                  </div>
                </div>
              ) : hasResult ? (
                <ScrollArea className="flex-1 pr-4 -mr-4">
                  <div className="space-y-6 pb-8">
                    {imagePreview && (
                      <div
                        ref={imageContainerRef}
                        className="relative rounded-lg overflow-hidden border border-slate-200 shadow-sm"
                      >
                        <img
                          src={imagePreview}
                          alt="元の作品"
                          className="w-full h-auto object-contain block"
                        />
                        {showRedLines && result.redLinesOverlay && (
                          <img
                            src={result.redLinesOverlay}
                            alt="赤ペン修正"
                            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                          />
                        )}
                        {showAnnotations && result.annotations.map((ann, i) => {
                          const catStyle = CATEGORY_STYLES[ann.category];
                          const isExpanded = expandedAnnotations.has(i);
                          const dotColor = catStyle.border.replace('border-', '').includes('red') ? '#f87171'
                            : catStyle.border.includes('orange') ? '#fb923c'
                            : catStyle.border.includes('blue') ? '#60a5fa'
                            : catStyle.border.includes('purple') ? '#c084fc'
                            : '#34d399';
                          return (
                            <div
                              key={i}
                              style={getAnnotationPosition(ann)}
                              className="absolute z-10 transition-all"
                            >
                              {isExpanded ? (
                                <div
                                  className={`min-w-[140px] max-w-[200px] w-max px-2 py-1.5 rounded-md border text-[11px] leading-tight font-medium shadow-lg backdrop-blur-sm cursor-pointer ${catStyle.bg} ${catStyle.border} ${catStyle.text}`}
                                  onClick={() => toggleAnnotation(i)}
                                >
                                  <span className="font-bold mr-1">{i + 1}</span>
                                  {ann.text}
                                </div>
                              ) : (
                                <div
                                  className="w-6 h-6 rounded-full border-2 border-white shadow-lg cursor-pointer flex items-center justify-center text-white text-[10px] font-bold hover:scale-125 transition-transform"
                                  style={{ backgroundColor: dotColor, transform: 'translate(-50%, -50%)' }}
                                  onClick={() => toggleAnnotation(i)}
                                >
                                  {i + 1}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {result.summaryText && (
                      <div className="prose prose-slate prose-sm sm:prose-base max-w-none">
                        <h3 className="text-lg font-semibold text-slate-800 mb-2">総合講評</h3>
                        <ReactMarkdown>{result.summaryText}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-4 min-h-[400px]">
                  <PenTool className="w-12 h-12 opacity-20" />
                  <p className="text-sm text-center">
                    画像をアップロードして「AIに添削を依頼する」ボタンを押すと、<br/>
                    ここにアドバイスが表示されます。
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
