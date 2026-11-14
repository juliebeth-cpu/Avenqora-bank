import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PortalLayout from "@/components/layout/portal-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  portalGetPromoVideo,
  portalGetPromoVideoViewUrl,
  portalRequestPromoVideoUploadUrl,
  portalRegisterPromoVideo,
  portalDeletePromoVideo,
} from "@/lib/portal-api";
import {
  Video, Upload, Trash2, RefreshCw, Play, AlertCircle, FileVideo,
} from "lucide-react";

const MIN_DURATION_SEC = 20;
const ACCEPTED_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
const MAX_FILE_BYTES = 500 * 1024 * 1024; // 500 MB

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(ts: string | Date | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

export default function PromotionalVideoPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);

  // ── Fetch current video metadata ───────────────────────────────────────────
  const { data: video, isLoading } = useQuery({
    queryKey: ["portal-promo-video"],
    queryFn: portalGetPromoVideo,
  });

  // ── Fetch signed view URL (lazy — only when preview is opened) ─────────────
  const { data: viewData, refetch: refetchViewUrl } = useQuery({
    queryKey: ["portal-promo-video-view-url"],
    queryFn: portalGetPromoVideoViewUrl,
    enabled: false,
    staleTime: 50 * 60 * 1000, // signed URLs valid ~1 h
  });

  // ── Delete ────────────────────────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: portalDeletePromoVideo,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-promo-video"] });
      qc.removeQueries({ queryKey: ["portal-promo-video-view-url"] });
      setPreviewOpen(false);
      toast({ title: "Promotional video deleted" });
    },
    onError: (e: any) =>
      toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  // ── Upload ────────────────────────────────────────────────────────────────
  async function validateDuration(file: File): Promise<boolean> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const vid = document.createElement("video");
      vid.preload = "metadata";
      vid.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(vid.duration >= MIN_DURATION_SEC);
      };
      vid.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(true); // can't read metadata — let server decide
      };
      vid.src = url;
    });
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({ title: "Unsupported format", description: "Upload MP4, WebM, OGG, or MOV.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast({ title: "File too large", description: "Maximum 500 MB.", variant: "destructive" });
      return;
    }
    const durationOk = await validateDuration(file);
    if (!durationOk) {
      toast({ title: "Video too short", description: `Minimum ${MIN_DURATION_SEC} seconds required.`, variant: "destructive" });
      return;
    }

    setUploading(true);
    setUploadProgress(5);
    try {
      // Step 1 — request a presigned PUT URL from our API
      const { uploadURL, objectPath } = await portalRequestPromoVideoUploadUrl(
        file.name, file.size, file.type,
      );
      setUploadProgress(20);

      // Step 2 — upload file bytes directly to GCS via the presigned URL
      const xhr = new XMLHttpRequest();
      await new Promise<void>((resolve, reject) => {
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setUploadProgress(20 + Math.round((ev.loaded / ev.total) * 70));
          }
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`Upload failed (HTTP ${xhr.status})`));
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.open("PUT", uploadURL);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });
      setUploadProgress(92);

      // Step 3 — register the uploaded object in the database
      await portalRegisterPromoVideo(objectPath, file.name, file.size, file.type, {
        autoplay: true,
        loop: true,
        muted: false,
      });
      setUploadProgress(100);

      qc.invalidateQueries({ queryKey: ["portal-promo-video"] });
      qc.removeQueries({ queryKey: ["portal-promo-video-view-url"] });
      setPreviewOpen(false);
      toast({ title: video ? "Video replaced successfully" : "Video uploaded successfully" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function handlePreview() {
    setPreviewOpen(true);
    await refetchViewUrl();
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <PortalLayout>
        <div className="p-6 flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </PortalLayout>
    );
  }

  const hasVideo = !!video;

  return (
    <PortalLayout>
      <div className="p-6 space-y-6 max-w-3xl">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-white">Promotional Video</h1>
          <p className="text-slate-400 text-sm mt-1">
            Upload one promotional video for your website. Videos are completely
            independent between websites — replacing or deleting here only affects
            your site.
          </p>
        </div>

        {/* ── Upload progress bar ──────────────────────────────────────────── */}
        {uploading && (
          <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
              Uploading… {uploadProgress}%
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Video card ───────────────────────────────────────────────────── */}
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <Video className="w-4 h-4 text-blue-400" />
              {hasVideo ? "Current Promotional Video" : "No Video Uploaded"}
            </CardTitle>
          </CardHeader>

          <CardContent>
            {hasVideo ? (
              <div className="space-y-5">
                {/* Metadata grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  {[
                    ["File name", video.fileName],
                    ["File size", formatBytes(video.fileSize)],
                    ["Format",    video.contentType],
                    ["Updated",   formatDate(video.updatedAt)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-0.5">
                      <span className="text-slate-500 text-xs uppercase tracking-wider">{k}</span>
                      <span className="text-slate-200 font-medium truncate">{v}</span>
                    </div>
                  ))}
                </div>

                {/* Inline video preview */}
                {previewOpen && (
                  <div className="rounded-xl overflow-hidden bg-black border border-slate-700">
                    {viewData?.viewURL ? (
                      /* eslint-disable-next-line jsx-a11y/media-has-caption */
                      <video
                        key={viewData.viewURL}
                        autoPlay
                        loop
                        controls
                        className="w-full max-h-[420px] object-contain"
                        src={viewData.viewURL}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-40 gap-2 text-slate-500 text-sm">
                        <RefreshCw className="w-4 h-4 animate-spin" /> Loading preview…
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  {!previewOpen ? (
                    <Button
                      variant="outline" size="sm"
                      onClick={handlePreview}
                      className="border-slate-600 text-slate-300 hover:text-white"
                    >
                      <Play className="w-4 h-4 mr-1.5" /> Preview
                    </Button>
                  ) : (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setPreviewOpen(false)}
                      className="border-slate-600 text-slate-300 hover:text-white"
                    >
                      Hide Preview
                    </Button>
                  )}

                  <Button
                    variant="outline" size="sm"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-blue-600/50 text-blue-300 hover:text-white hover:border-blue-500"
                  >
                    <RefreshCw className="w-4 h-4 mr-1.5" /> Replace Video
                  </Button>

                  <Button
                    variant="outline" size="sm"
                    disabled={deleteMut.isPending || uploading}
                    onClick={() => {
                      if (confirm("Delete the promotional video? This cannot be undone.")) {
                        deleteMut.mutate();
                      }
                    }}
                    className="border-red-600/40 text-red-400 hover:text-white hover:bg-red-600/20"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    {deleteMut.isPending ? "Deleting…" : "Delete"}
                  </Button>
                </div>
              </div>
            ) : (
              /* ── Empty state ─────────────────────────────────────────────── */
              <div className="flex flex-col items-center justify-center py-14 gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-700/60 border border-slate-600 flex items-center justify-center">
                  <FileVideo className="w-8 h-8 text-slate-500" />
                </div>
                <div>
                  <p className="text-slate-300 font-medium">No promotional video yet</p>
                  <p className="text-slate-500 text-sm mt-1">
                    Upload a video to showcase your website to visitors.
                  </p>
                </div>
                <Button
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Upload className="w-4 h-4 mr-2" /> Upload Video
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Requirements card ────────────────────────────────────────────── */}
        <Card className="bg-slate-800/40 border-slate-700/50">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1 text-sm">
                <p className="text-slate-300 font-medium">Video requirements</p>
                <ul className="text-slate-500 space-y-0.5 list-disc list-inside">
                  <li>Minimum length: 20 seconds</li>
                  <li>Maximum file size: 500 MB</li>
                  <li>Preferred format: MP4 (H.264)</li>
                  <li>Also accepted: WebM, OGG, MOV</li>
                  <li>Each website has its own independent video</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hidden file input — supports both phone camera and file picker */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/ogg,video/quicktime"
          capture={undefined}   // allows choosing between camera and file on mobile
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    </PortalLayout>
  );
}
