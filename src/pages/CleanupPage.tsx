import { useRef, useState } from 'react';
import { ArrowLeft, Download, Eraser, Loader2, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { removeTensakuMarks } from '@/lib/imageCleanup';

function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function CleanupPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [beforeImageUrl, setBeforeImageUrl] = useState<string | null>(null);
  const [afterImageUrl, setAfterImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingLabel, setLoadingLabel] = useState('画像を準備中...');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applySelectedFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('画像ファイルを選択してください。');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedFile(file);
      setBeforeImageUrl(reader.result as string);
      setAfterImageUrl(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      applySelectedFile(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      applySelectedFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleUploadKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!beforeImageUrl && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      fileInputRef.current?.click();
    }
  };

  const runCleanup = async () => {
    if (!selectedFile || !beforeImageUrl) return;

    setIsLoading(true);
    setError(null);
    setAfterImageUrl(null);

    try {
      setLoadingLabel('添削インクを検出中...');
      const cleaned = await removeTensakuMarks(beforeImageUrl, selectedFile.type);
      setLoadingLabel('仕上げ処理中...');
      setAfterImageUrl(cleaned);
    } catch (cleanupError) {
      console.error(cleanupError);
      setError('添削除去に失敗しました。APIキー設定とネットワークを確認して再試行してください。');
    } finally {
      setIsLoading(false);
      setLoadingLabel('画像を準備中...');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="space-y-4 text-center">
          <Link to="/" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            添削ページへ戻る
          </Link>
          <div className="inline-flex items-center justify-center rounded-full bg-blue-100 p-3">
            <Eraser className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">添削除去ページ</h1>
          <p className="mx-auto max-w-3xl text-lg text-slate-600">
            添削入り画像をアップロードすると、赤線・赤コメント・青線・青コメントを除去して、
            元の線画をできるだけ保持した画像を生成します。
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-3">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>画像アップロード</CardTitle>
              <CardDescription>添削が入った画像を選択してください</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                  beforeImageUrl
                    ? 'border-slate-200 bg-slate-50'
                    : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'
                }`}
                onClick={() => !beforeImageUrl && fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onKeyDown={handleUploadKeyDown}
                role="button"
                tabIndex={0}
                aria-label="添削入り画像を選択"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {beforeImageUrl ? (
                  <div className="group relative">
                    <img
                      src={beforeImageUrl}
                      alt="Before preview"
                      className="mx-auto max-h-[250px] rounded-lg object-contain shadow-sm"
                    />
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="secondary"
                        onClick={(event) => {
                          event.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                      >
                        画像を変更
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 py-8">
                    <div className="mx-auto w-fit rounded-full bg-white p-3 shadow-sm">
                      <Upload className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">
                      クリックまたはドラッグ&ドロップで画像を選択
                    </p>
                    <p className="text-xs text-slate-500">PNG, JPG, WEBP</p>
                  </div>
                )}
              </div>

              <Button
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
                size="lg"
                onClick={runCleanup}
                disabled={!beforeImageUrl || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {loadingLabel}
                  </>
                ) : (
                  <>
                    <Eraser className="mr-2 h-5 w-5" />
                    添削を除去する
                  </>
                )}
              </Button>

              {afterImageUrl && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => downloadDataUrl(afterImageUrl, `cleanup-${selectedFile?.name || 'result.png'}`)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  画像をダウンロード
                </Button>
              )}

              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Before / After</CardTitle>
              <CardDescription>左が入力画像、右が添削除去後画像です</CardDescription>
            </CardHeader>
            <CardContent>
              {!beforeImageUrl ? (
                <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
                  画像をアップロードすると比較表示されます
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Before</p>
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <img src={beforeImageUrl} alt="Before" className="h-auto w-full object-contain" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">After</p>
                    <div className="flex min-h-[220px] items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                      {afterImageUrl ? (
                        <img src={afterImageUrl} alt="After" className="h-auto w-full object-contain" />
                      ) : isLoading ? (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          生成中...
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">ここに生成結果が表示されます</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
