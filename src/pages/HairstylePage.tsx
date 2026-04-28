import { useState, useRef, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Upload, Image as ImageIcon, Loader2, PenTool, Eye, EyeOff, CheckCircle2, Circle, Scissors } from 'lucide-react';
import { Link } from 'react-router-dom';
import { compressBase64ForApi } from '../utils/compressImage';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TeacherProfile {
  id: string;
  name: string;
  title: string;
  description: string;
  style: string;
  persona: string;
  criteria: string;
}

const DEFAULT_CRITERIA = `1. **つむじと毛の流れ**: つむじの位置から放射状に髪が流れているか
2. **ボリューム**: 頭の形に対して適切なボリュームがあるか（ペタッとしすぎ／膨らみすぎ）
3. **毛束の表現**: 毛束をリボン状に捉え、裏表の立体感があるか
4. **前髪の処理**: 前髪のカットライン、分け目、ふんわり感が表現されているか
5. **毛先の処理**: 毛先が自然か（枝分かれしすぎていないか）
6. **髪質の表現**: ツヤ、サラサラ感、まとまり感が出ているか`;

const TEACHERS: readonly TeacherProfile[] = [
  {
    id: 'default',
    name: '日本マンガ塾',
    title: '標準添削',
    description: '基本に忠実な添削。つむじ・ボリューム・毛束・前髪・毛先・髪質を総合的に指導',
    style: 'bg-emerald-100 border-emerald-300 text-emerald-800',
    persona: `あなたはマンガイラストコースのベテラン講師です。
- 基本に忠実で、髪の描き方の基礎をしっかり指導
- 良い点は積極的に褒め、改善点は具体的なテクニックを交えて指導
- フレンドリーで温かい口調`,
    criteria: DEFAULT_CRITERIA,
  },
  {
    id: 'kishimoto',
    name: '岸本 斉史',
    title: 'NARUTO作者',
    description: '一本一本描かずにサラサラに見せる技術、スパイクの方向性とパースの一致',
    style: 'bg-orange-100 border-orange-300 text-orange-800',
    persona: `あなたは岸本斉史先生（NARUTO作者）のような指導スタイルで添削します。
- 「一本一本描いていないのにサラサラに見える」髪の描き方を重視（綱手やネジのような表現）
- 髪のスパイクはランダムではなく、パースと方向性に従って配置することを指導
- 石膏デッサンで培った陰影表現（陰の中にも反射光で明るい部分がある）を髪にも応用
- 「ファンタジーだからこそリアルな部分で嘘をつかない」という姿勢
- キャラごとの髪型の描き分け（サスケとイタチの差はサラサラ感と長さ）を意識
- 熱血で励ましの多い口調`,
    criteria: `1. **サラサラ感の表現**: 一本一本描かずとも髪のサラサラ感が伝わっているか（ベタやトーンに頼らない立体感）
2. **スパイクの方向性**: 髪のスパイクや毛先がランダムではなく、パースと頭の丸みに従った方向性を持っているか
3. **キャラの描き分け**: 髪型の違い（長さ、質感、動き）でキャラクターの個性が差別化されているか
4. **陰影の立体感**: 髪の陰影に奥行きがあるか（影の中の反射光など、単調でない陰影処理）
5. **動きとの連動**: アクションを想像したとき、髪がどう動くか意識されているか（脳内動画メソッド）
6. **重心とリアリティ**: 髪の重力感が自然で、キャラクターの重心や姿勢と一致しているか`,
  },
  {
    id: 'oda',
    name: '尾田 栄一郎',
    title: 'ONE PIECE作者',
    description: 'シルエットだけで誰かわかるデザイン力、大胆な線で毛束を塊として捉える',
    style: 'bg-red-100 border-red-300 text-red-800',
    persona: `あなたは尾田栄一郎先生（ONE PIECE作者）のような指導スタイルで添削します。
- 「シルエットだけでどのキャラかわかる」髪型デザインを最も重視
- 毛束を個々の線ではなく大きな塊（クランプ）として捉え、太い輪郭線で描くことを推奨
- 髪の動きは物理法則を超えた誇張でエネルギーを表現する
- 感情やパワーアップが髪に表れる演出（ギア5のような変化）を意識
- 明るく豪快でノリの良い口調`,
    criteria: `1. **シルエットの即時認識性**: 髪を黒く塗りつぶしてもどのキャラかわかるか（シルエットテスト）
2. **毛束の塊としての表現**: 髪を一本一本ではなく、大きな塊（クランプ）として少ない線でダイナミックに描けているか
3. **キャラの差別化**: 複数キャラを並べたとき、髪型だけで全員見分けがつくデザインか
4. **動きの誇張**: 風や動作に対して、リアルを超えた大胆な髪の動きで躍動感が出ているか
5. **太い輪郭線の力強さ**: 髪の外形の線に迷いがなく、力強いアウトラインで描けているか
6. **感情との連動**: 髪型がキャラの性格（ワイルド、知的、優雅など）を的確に表現しているか`,
  },
  {
    id: 'takeshi_obata',
    name: '小畑 健',
    title: 'DEATH NOTE作画',
    description: '迷いのない線で髪一本一本を描き込む繊細さ、カラーでは塗りで立体を構築',
    style: 'bg-slate-100 border-slate-400 text-slate-800',
    persona: `あなたは小畑健先生（DEATH NOTE作画）のような指導スタイルで添削します。
- 「髪の毛一本一本まで描き込まれた繊細さ」を追求する姿勢を重視
- 「線が少ない、つまり迷いがない」速筆かつ精密な線を目指す指導
- カラーでは線画で外側の輪郭だけ描き、塗りの段階で影と光を置いて立体感を構築する技法を指導
- 髪型がキャラの性格・テンションを反映しているかを確認（ナッセの例：おかっぱ→外跳ねで印象が激変）
- 落ち着いた丁寧な口調で、技術的に具体的なアドバイス`,
    criteria: `1. **線の迷いのなさ**: 髪の線に躊躇がなく、一本一本が確信を持って引かれているか（描き直しを恐れない精神も含む）
2. **繊細な描き込みの密度**: 髪の毛一本一本のレベルまで丁寧に描き込まれているか、線の強弱に緩急があるか
3. **光と影による立体構築**: 髪のハイライトと陰影が光源に基づいて配置され、ペン線ではなく面の対比で立体感が出ているか
4. **髪型とキャラクター性の一致**: 髪型がキャラの性格やテンションを正しく反映しているか（髪型を変えると印象がどう変わるか意識しているか）
5. **生え際・もみあげ・後れ毛の細部**: 髪の外形だけでなく、生え際やもみあげなど見落としがちな部分まで意識が行き届いているか
6. **写実とマンガの融合**: リアルに寄せすぎず、どこかマンガ的な魅力を残したバランスになっているか`,
  },
  {
    id: 'rumiko',
    name: '高橋 留美子',
    title: 'うる星やつら・犬夜叉作者',
    description: 'Gペンの入り抜きを活かした美しい曲線、前髪から描き始める独自の手法',
    style: 'bg-pink-100 border-pink-300 text-pink-800',
    persona: `あなたは高橋留美子先生（うる星やつら・犬夜叉作者）のような指導スタイルで添削します。
- Gペンの入り抜きを最大限活かした、太さの変化する美しい曲線を重視
- 「前髪から描き始める」手法（つけペンのインク乾燥を考慮した実践的テクニック）を推奨
- 丸みを帯びた柔らかい線で髪を表現する（筆で描いたような質感）
- 前髪の丸みが特に重要（ラムちゃんの前髪のように、顔を柔らかくフレーミングする）
- 髪を体と同じく有機的・流動的に描く（池上遼一から学んだリアルで美しいライン）
- 親しみやすく温かい口調、褒め上手`,
    criteria: `1. **線の入り抜きの美しさ**: 髪の線が太くなったり細くなったり、Gペン的な強弱のニュアンスを持っているか
2. **前髪の丸みとフレーミング**: 前髪が顔を柔らかくフレーミングし、キャラの魅力を引き立てる丸みを持っているか
3. **曲線の柔らかさ**: 髪の線がカクカクせず、丸みを帯びた優しい曲線で描かれているか
4. **少ない線数での表現力**: 最小限の線で髪の動き・質感・ボリュームが伝わっているか（描きすぎていないか）
5. **表情の邪魔をしない可読性**: 髪が顔の表情を遮らず、コマの中で読みやすいデザインになっているか
6. **流動的な有機体としての髪**: 髪が硬い物体ではなく、風や動きに自然に反応する有機的な流れを持っているか`,
  },
  {
    id: 'araki',
    name: '荒木 飛呂彦',
    title: 'ジョジョの奇妙な冒険作者',
    description: 'ベルニーニの彫刻に学んだ立体表現、シルエットが記号として機能する髪型設計',
    style: 'bg-violet-100 border-violet-300 text-violet-800',
    persona: `あなたは荒木飛呂彦先生（ジョジョの奇妙な冒険作者）のような指導スタイルで添削します。
- ベルニーニやミケランジェロの彫刻から学んだ「蛇状曲線体（フィグーラ・セルペンティナータ）」を髪にも応用
- 髪型はキャラクターの「記号」であり、シルエットだけで誰かわかるようにデザインする（36項目の身上調査書でキャラを深く理解してからデザイン）
- ファッション誌『ヴォーグ』のモデルからポージングと髪の関係を学ぶ
- 髪型はキャラの物語テーマと不可分（仗助のリーゼント＝恩人への敬意）
- 色に固定観念を持たない（ゴーギャンから学んだ自由な色彩感覚）
- 独特の美学に基づいた格調高い口調、「記憶に刻みつける絵」を目指す`,
    criteria: `1. **彫刻的な立体感**: 髪をベルニーニの彫刻のようにねじれ・うねりのある立体物として描けているか（蛇状曲線体の意識）
2. **シルエットの記号性**: 髪型がそのキャラ固有の「記号」として機能し、シルエットだけで一目でわかるか（他キャラとの記号の重複がないか）
3. **ポーズとの連動**: 体のひねりや首の角度に合わせて、髪が自然かつ劇的に連動しているか（マニエリスム的な動き）
4. **明暗対比（キアロスクーロ）**: 髪の中でベタ（黒）と白のコントラストが劇的に使われ、ドラマチックな印象があるか
5. **ファッション性とデザイン性**: 髪型にモード的なスタイリッシュさや、既成概念を超えた独自のデザインがあるか
6. **記憶に刻まれる印象**: 何年後に見ても「あの髪型だ！」とすぐにわかるほど強烈な印象を持つデザインか`,
  },
] as const;

interface ImageDimensions {
  width: number;
  height: number;
}

type HairCategory = 'hair_flow' | 'volume' | 'texture' | 'structure' | 'general';

interface TextAnnotation {
  x: number;
  y: number;
  text: string;
  category: HairCategory;
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
        const isBluish = cB > 120 && cB > cR * 1.2 && cB > cG * 1.2;
        const isSignificantDiff = totalDiff > 80;

        if ((isReddish || isBluish) && isSignificantDiff) {
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

const CATEGORY_STYLES: Record<HairCategory, { bg: string; border: string; text: string; label: string }> = {
  hair_flow: { bg: 'bg-red-50/95', border: 'border-red-400', text: 'text-red-700', label: '毛の流れ' },
  volume: { bg: 'bg-orange-50/95', border: 'border-orange-400', text: 'text-orange-700', label: 'ボリューム' },
  texture: { bg: 'bg-blue-50/95', border: 'border-blue-400', text: 'text-blue-700', label: '質感' },
  structure: { bg: 'bg-purple-50/95', border: 'border-purple-400', text: 'text-purple-700', label: '構造' },
  general: { bg: 'bg-emerald-50/95', border: 'border-emerald-400', text: 'text-emerald-700', label: '全般' },
};

const LOADING_STEPS = [
  { label: '画像を分析中', desc: '提出された髪型の描画を読み取っています' },
  { label: '赤ペン修正を生成中', desc: '髪の流れやボリュームの修正線を描いています' },
  { label: '修正線を抽出中', desc: '元画像に重ねる赤ペンレイヤーを作成しています' },
  { label: 'テキスト注釈を生成中', desc: '髪型に対する具体的なアドバイスを作成しています' },
  { label: '完了', desc: '' },
];

const TIPS = [
  '💡 髪の毛はつむじから放射状に生えています。つむじの位置を意識しましょう',
  '💡 毛束をリボン状の物体としてイメージすると、裏表の立体感が出せます',
  '💡 前髪のカットラインを意識すると、キャラクターの個性が際立ちます',
  '💡 髪のツヤは光源の位置に合わせて、天使の輪を描くと自然になります',
  '💡 毛先を細かく枝分かれさせすぎると、髪質が荒れて見えるので注意',
  '💡 束の髪の毛に一本線の髪の毛を付け加えると、サラサラ感が伝わります',
  '💡 ショートヘアは頭の丸みに沿って、ボリュームを適切に配置しましょう',
  '💡 セミロングは肩に当たって跳ねる動きを意識すると自然になります',
];

export default function HairstylePage() {
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
  const [selectedTeacher, setSelectedTeacher] = useState<string>('default');
  const [debugMode, setDebugMode] = useState(false);
  const [debugDots, setDebugDots] = useState<Array<{ x: number; y: number }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const teacher = TEACHERS.find(t => t.id === selectedTeacher) ?? TEACHERS[0];

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

  const handleUploadKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!imagePreview && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

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
    const prompt = `あなたはプロの漫画家・イラストレーターの講師です。「髪型課題」の添削を行います。

【指導スタイル】
${teacher.persona}

【課題の説明】
この課題は、マンガイラストコースの髪型練習です。課題用紙にはあらかじめ坊主頭（ハゲ頭）のキャラクターが印刷されており、生徒はその上に髪の毛を描き加えます。
- 課題①: ショートヘアの男子を描く（上段）
- 課題②: セミロングの女子を描く（下段）
右側にお手本のキャラクターイラストが印刷されています。

元画像のサイズは ${dims.width}×${dims.height} ピクセルです。

【添削の観点 — 髪型に特化した指導】
以下の点を重点的に添削してください：
${teacher.criteria}

【重要な指示】
- 元の絵の上に「赤い修正線」と「青い修正線」を描き込んでください
- 赤い線: 修正が必要な箇所の正しい髪の流れやシルエットを示す
- 青い線: 補助的な構造線（つむじからの放射線、頭の丸みガイドなど）
- 文字やテキストは一切書き込まないでください
- 元の絵をできるだけ残し、修正が必要な部分に線を重ねてください
- テキスト注釈は別途生成するので、画像には絶対に文字を入れないでください
- 出力画像は元画像とまったく同じアスペクト比・解像度にしてください

良い点もしっかり認めた上で、改善点を具体的に示してください。`;

    const response = await fetch('/api/generate-image-correction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data, mimeType, prompt }),
    });

    if (!response.ok) throw new Error('Image correction API failed');
    const data = await response.json();

    if (data.imageData) {
      return `data:${data.mimeType || 'image/png'};base64,${data.imageData}`;
    }
    return null;
  }, [teacher.persona, teacher.criteria]);

  const generateTextAnnotations = useCallback(async (
    originalBase64: string,
    originalMimeType: string,
    correctedDataUrl: string | null,
  ): Promise<{ annotations: TextAnnotation[]; summary: string }> => {
    const images: Array<{ base64Data: string; mimeType: string }> = [];

    if (correctedDataUrl) {
      const correctedBase64 = correctedDataUrl.split(',')[1];
      const correctedMime = correctedDataUrl.split(';')[0].split(':')[1];
      images.push(await compressBase64ForApi(correctedBase64, correctedMime));
    }

    images.push(await compressBase64ForApi(originalBase64, originalMimeType));

    const baseContext = `あなたはプロの漫画家・イラストレーターの講師です。「髪型課題」の添削を行っています。

【指導スタイル】
${teacher.persona}

【課題の説明】
マンガイラストコースの髪型練習課題です。課題用紙には坊主頭のキャラクターが印刷されており、生徒がその上に髪の毛を描き加えています。
- 課題①（上段）: ショートヘアの男子
- 課題②（下段）: セミロングの女子

【添削の観点 — 髪の描き方に特化】
${teacher.criteria}

良い点は積極的に褒め、改善点は具体的なテクニックを交えて指導してください。
添削サンプルの講師のようにフレンドリーで温かい口調で書いてください。`;

    const prompt = correctedDataUrl
      ? `${baseContext}

添付画像について:
- 1枚目: 赤ペン・青ペンで修正線を入れた添削済み画像（この画像の座標を使ってください）
- 2枚目: 生徒の元の絵（参考用）

【タスク】
添削済み画像（1枚目）に描かれている修正線の位置に、注釈テキストをパーセンテージ座標付きで配置してください。

【重要：座標配置のルール】
- 注釈は必ず「生徒が髪を描いた絵の部分」にのみ配置してください
- ヘッダー、課題タイトル、ラベル行、氏名欄、右側のお手本イラストの上には絶対に注釈を置かないでください

【座標の指定方法 — パーセンテージで指定】
座標はピクセルではなく、画像全体に対するパーセンテージ（0〜100）で指定してください。
- x: 画像の左端が0、右端が100
- y: 画像の上端が0、下端が100

例:
- 画像の左上角 = (x: 0, y: 0)
- 画像の中央 = (x: 50, y: 50)
- 画像の右下角 = (x: 100, y: 100)

以下のJSON形式で回答してください。他のテキストは含めないでください。

{
  "annotations": [
    {
      "x": 25,
      "y": 30,
      "text": "つむじを意識して毛の流れを描くと自然になりますよ！",
      "category": "hair_flow"
    }
  ],
  "summary": "全体的な講評"
}

フィールド説明:
- x: 修正箇所の水平位置（パーセンテージ、0=左端, 100=右端）
- y: 修正箇所の垂直位置（パーセンテージ、0=上端, 100=下端）
- text: その修正箇所に対する具体的なアドバイス（日本語、50文字以内、フレンドリーな口調で）
- category: "hair_flow"（毛の流れ） / "volume"（ボリューム） / "texture"（質感） / "structure"（構造） / "general"（全般）
- summary: 全体的な講評（マークダウン形式、良い点をまず褒めてから改善点を述べる）

注意:
- annotationsは4〜10個（課題①と課題②の両方に注釈をつけてください）
- 注釈は生徒が描いた髪の上、または描画エリア内の修正線の位置にのみ配置してください
- ヘッダー、ラベル行、お手本イラストの上には絶対に座標を置かないこと
- 具体的なテクニック（つむじの描き方、毛束の捉え方など）を含めてください`
      : `${baseContext}

修正が必要な箇所に注釈テキストをパーセンテージ座標付きで配置してください。

【重要：座標配置のルール】
- 注釈は「生徒が髪を描いた絵の部分」にのみ配置してください
- ヘッダー、ラベル行、氏名欄、右側のお手本イラストには置かないでください

【座標の指定方法 — パーセンテージで指定】
- x: 画像の左端が0、右端が100
- y: 画像の上端が0、下端が100

以下のJSON形式で回答してください。

{
  "annotations": [
    {
      "x": 25,
      "y": 30,
      "text": "修正アドバイス",
      "category": "hair_flow"
    }
  ],
  "summary": "全体的な講評"
}

- x: 水平位置（パーセンテージ、0〜100）
- y: 垂直位置（パーセンテージ、0〜100）
- text: アドバイス（日本語、50文字以内）
- category: "hair_flow" / "volume" / "texture" / "structure" / "general"
- summary: 全体的な講評（マークダウン形式、良い点をまず褒める）
- annotationsは4〜10個（課題①と課題②の描画エリアにのみ配置）`;

    const response = await fetch('/api/generate-text-annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images, prompt }),
    });

    if (!response.ok) throw new Error('Text annotation API failed');
    const parsed = await response.json();
    return {
      annotations: (parsed.annotations || []).map((a: { x: number; y: number; text: string; category: HairCategory; anchor?: TextAnnotation['anchor'] }) => {
        const xPct = Math.max(0, Math.min(100, a.x));
        const yPct = Math.max(0, Math.min(100, a.y));
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
  }, [teacher.persona, teacher.criteria]);

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
      const originalDims = await getImageDimensions(imagePreview);

      setLoadingStep(1);
      let correctedImageUrl: string | null = null;
      let redLinesOverlay: string | null = null;
      try {
        const rawCorrected = await generateImageCorrection(base64Data, mimeType, originalDims);
        if (rawCorrected) {
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

      setLoadingStep(3);
      let annotationResult: { annotations: TextAnnotation[]; summary: string } | null = null;
      try {
        annotationResult = await generateTextAnnotations(base64Data, mimeType, correctedImageUrl);
      } catch (textErr) {
        console.error('Text annotation generation failed:', textErr);
      }

      if (!redLinesOverlay && !annotationResult) {
        setError('添削結果の生成に失敗しました。もう一度お試しください。');
        return;
      }

      setLoadingStep(4);
      const annotations = annotationResult?.annotations || [];
      setResult({
        redLinesOverlay,
        annotations,
        summaryText: annotationResult?.summary || null,
      });
      setExpandedAnnotations(new Set());
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

    if (x > 55) {
      style.right = `${100 - x}%`;
      style.transform = y > 75 ? 'translateY(-100%)' : undefined;
    } else {
      style.left = `${x}%`;
      style.transform = y > 75 ? 'translateY(-100%)' : undefined;
    }

    return style;
  };

  const handleDebugClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!debugMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setDebugDots(prev => [...prev, { x, y }]);
  };

  const hasResult = result && (result.redLinesOverlay || result.annotations.length > 0);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="text-center space-y-4">
          <div className="flex justify-center gap-2">
            <Link to="/" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              トップページへ
            </Link>
          </div>
          <div className="inline-flex items-center justify-center p-3 bg-purple-100 rounded-full mb-4">
            <Scissors className="w-8 h-8 text-purple-600" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">髪型課題 AI添削</h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            髪型課題（課題02）の提出画像をアップロードしてください。髪の流れ・ボリューム・質感など、髪の描き方に特化したアドバイスを提供します。
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-xs text-slate-500">
            <span className="bg-slate-100 px-2 py-1 rounded">課題①ショートの男子</span>
            <span className="bg-slate-100 px-2 py-1 rounded">課題②セミロングの女子</span>
          </div>
          <button
            type="button"
            className={`text-[10px] px-2 py-0.5 rounded ${debugMode ? 'bg-yellow-300 text-yellow-900' : 'bg-slate-200 text-slate-400'}`}
            onClick={() => { setDebugMode(!debugMode); setDebugDots([]); }}
          >
            {debugMode ? 'DEBUG ON (click image to place dots)' : 'debug'}
          </button>
        </header>

        <div className="grid lg:grid-cols-3 gap-8">
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle>課題の提出</CardTitle>
              <CardDescription>記入済みの髪型課題をアップロード</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                  imagePreview ? 'border-slate-200 bg-slate-50' : 'border-slate-300 hover:border-purple-400 hover:bg-purple-50'
                }`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => !imagePreview && fileInputRef.current?.click()}
                onKeyDown={handleUploadKeyDown}
                role="button"
                tabIndex={0}
                aria-label="髪型課題の画像を選択"
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
                      <p className="text-sm font-medium text-slate-700">クリックまたはドラッグ＆ドロップ</p>
                      <p className="text-xs text-slate-500">記入済みの髪型課題用紙をアップロード</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">添削する先生を選択</label>
                <div className="space-y-1.5">
                  {TEACHERS.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      className={`w-full text-left p-2.5 rounded-lg border transition-all text-xs ${
                        selectedTeacher === t.id
                          ? `${t.style} ring-2 ring-offset-1 ring-slate-400 shadow-sm`
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                      onClick={() => setSelectedTeacher(t.id)}
                      disabled={isLoading}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${selectedTeacher === t.id ? 'bg-current' : 'bg-slate-300'}`} />
                        <span className="font-semibold">{t.name}</span>
                        <span className="text-[10px] opacity-70">({t.title})</span>
                      </div>
                      {selectedTeacher === t.id && (
                        <p className="mt-1 ml-4 text-[10px] opacity-80 leading-relaxed">{t.description}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
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
                    {teacher.name}先生にAI添削を依頼する
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
                          {ann.text}
                          {isExpanded && <span className="ml-1 text-[10px] opacity-50">（クリックで閉じる）</span>}
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
                              <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
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

                  <div className="text-center text-xs text-slate-400">
                    経過時間: {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center transition-all">
                    <p className="text-xs text-purple-700 leading-relaxed">{currentTip}</p>
                  </div>
                </div>
              ) : hasResult ? (
                <ScrollArea className="flex-1 pr-4 -mr-4">
                  <div className="space-y-6 pb-8">
                    {imagePreview && (
                      <div
                        ref={imageContainerRef}
                        className={`relative rounded-lg overflow-hidden border shadow-sm ${debugMode ? 'border-yellow-400 cursor-crosshair' : 'border-slate-200'}`}
                        onClick={handleDebugClick}
                      >
                        <img
                          src={imagePreview}
                          alt="提出した課題"
                          className="w-full h-auto object-contain block"
                        />
                        {debugMode && debugDots.map((dot, i) => (
                          <div
                            key={`debug-${i}`}
                            className="absolute z-50 pointer-events-none"
                            style={{ left: `${dot.x}%`, top: `${dot.y}%` }}
                          >
                            <div className="w-3 h-3 bg-yellow-400 border-2 border-yellow-700 rounded-full" style={{ transform: 'translate(-50%, -50%)' }} />
                            <div className="absolute left-2 top-[-8px] bg-yellow-100 border border-yellow-500 px-1 rounded text-[9px] font-mono text-yellow-900 whitespace-nowrap">
                              x:{dot.x.toFixed(1)} y:{dot.y.toFixed(1)}
                            </div>
                          </div>
                        ))}
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
                                <button
                                  type="button"
                                  className={`min-w-[140px] max-w-[200px] w-max px-2.5 py-2 rounded-lg border text-[11px] leading-snug font-medium shadow-xl backdrop-blur-sm cursor-pointer animate-in fade-in duration-200 ${catStyle.bg} ${catStyle.border} ${catStyle.text}`}
                                  onClick={() => toggleAnnotation(i)}
                                  aria-label={`注釈${i + 1}を閉じる`}
                                >
                                  <span className="font-bold mr-1">{i + 1}</span>
                                  {ann.text}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="relative cursor-pointer group"
                                  onClick={() => toggleAnnotation(i)}
                                  aria-label={`注釈${i + 1}を開く`}
                                >
                                  <div
                                    className="w-7 h-7 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-[11px] font-bold group-hover:scale-125 transition-transform"
                                    style={{ backgroundColor: dotColor, transform: 'translate(-50%, -50%)' }}
                                  >
                                    {i + 1}
                                  </div>
                                  <div
                                    className="absolute inset-0 w-7 h-7 rounded-full animate-ping opacity-30"
                                    style={{ backgroundColor: dotColor, transform: 'translate(-50%, -50%)', animationDuration: '2s', animationIterationCount: '3' }}
                                  />
                                </button>
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
                  {debugMode && imagePreview ? (
                    <div
                      className="relative w-full rounded-lg overflow-hidden border border-yellow-400 cursor-crosshair"
                      onClick={handleDebugClick}
                    >
                      <img src={imagePreview} alt="Debug preview" className="w-full h-auto object-contain block" />
                      {debugDots.map((dot, i) => (
                        <div
                          key={`debug-${i}`}
                          className="absolute z-50 pointer-events-none"
                          style={{ left: `${dot.x}%`, top: `${dot.y}%` }}
                        >
                          <div className="w-3 h-3 bg-yellow-400 border-2 border-yellow-700 rounded-full" style={{ transform: 'translate(-50%, -50%)' }} />
                          <div className="absolute left-2 top-[-8px] bg-yellow-100 border border-yellow-500 px-1 rounded text-[9px] font-mono text-yellow-900 whitespace-nowrap">
                            x:{dot.x.toFixed(1)} y:{dot.y.toFixed(1)}
                          </div>
                        </div>
                      ))}
                      <div className="absolute top-2 left-2 bg-yellow-100/90 border border-yellow-400 rounded px-2 py-1 text-[10px] font-mono text-yellow-800">
                        DEBUG: 画像をクリックして座標を確認 ({debugDots.length} dots)
                        {debugDots.length > 0 && (
                          <button type="button" className="ml-2 underline" onClick={(e) => { e.stopPropagation(); setDebugDots([]); }}>clear</button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <Scissors className="w-12 h-12 opacity-20" />
                      <p className="text-sm text-center">
                        記入済みの髪型課題をアップロードして<br/>
                        「AIに添削を依頼する」ボタンを押すと、<br/>
                        髪の描き方に特化したアドバイスが表示されます。
                      </p>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
