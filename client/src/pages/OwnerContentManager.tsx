import { useEffect, useRef, useState } from "react";

const card: React.CSSProperties = { background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "1rem", marginBottom: "1rem" };
const field: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: ".7rem .8rem", borderRadius: 8, border: "1px solid #475569", background: "#0f172a", color: "#f1f5f9", marginBottom: 9 };
const emptyPage = { title: "", slug: "", content: "", status: "draft", seoTitle: "", seoDescription: "" };

function headers() {
  return { Authorization: "Bearer " + (localStorage.getItem("admin_token") ?? "") };
}

async function responseData(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data;
}

export default function OwnerContentManager() {
  const [pages, setPages] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [pageId, setPageId] = useState<number | null>(null);
  const [pageDraft, setPageDraft] = useState<any>(emptyPage);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function load() {
    setError("");
    const [pageResponse, mediaResponse] = await Promise.all([
      fetch("/api/owner-content/admin/pages", { headers: headers() }),
      fetch("/api/owner-content/admin/media", { headers: headers() }),
    ]);
    const [pageData, mediaData] = await Promise.all([
      responseData(pageResponse), responseData(mediaResponse),
    ]);
    setPages(Array.isArray(pageData.pages) ? pageData.pages : []);
    setMedia(Array.isArray(mediaData.media) ? mediaData.media : []);
  }

  useEffect(() => { void load().catch(failure => setError(failure.message)); }, []);

  function startNewPage() {
    setPageId(null);
    setPageDraft({ ...emptyPage });
    setMessage("");
  }

  function selectPage(page: any) {
    setPageId(page.id);
    setPageDraft({
      title: page.title, slug: page.slug, content: page.content ?? "", status: page.status,
      seoTitle: page.seoTitle ?? "", seoDescription: page.seoDescription ?? "",
    });
    setMessage("");
  }

  async function savePage(event: React.FormEvent) {
    event.preventDefault();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pageDraft.slug.trim())) {
      setError("Use lowercase letters, numbers, and hyphens for the page URL.");
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const method = pageId ? "PATCH" : "POST";
      const path = pageId ? "/api/owner-content/admin/pages/" + pageId : "/api/owner-content/admin/pages";
      const payload = await responseData(await fetch(path, {
        method,
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pageDraft,
          title: pageDraft.title.trim(),
          slug: pageDraft.slug.trim(),
          seoTitle: pageDraft.seoTitle.trim() || null,
          seoDescription: pageDraft.seoDescription.trim() || null,
        }),
      }));
      await load();
      setPageId(payload.id);
      setPageDraft({ title: payload.title, slug: payload.slug, content: payload.content, status: payload.status, seoTitle: payload.seoTitle ?? "", seoDescription: payload.seoDescription ?? "" });
      setMessage("Page saved.");
    } catch (failure: any) {
      setError(failure.message ?? "Page could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePage(page: any) {
    setError(""); setMessage("");
    try {
      await responseData(await fetch("/api/owner-content/admin/pages/" + page.id, {
        method: "PATCH", headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ status: page.status === "published" ? "draft" : "published" }),
      }));
      await load();
      setMessage(page.status === "published" ? "Page unpublished." : "Page published.");
    } catch (failure: any) { setError(failure.message ?? "Page status could not be updated."); }
  }

  async function deletePage(page: any) {
    if (!window.confirm("Delete " + page.title + "? This cannot be undone.")) return;
    setError(""); setMessage("");
    try {
      const response = await fetch("/api/owner-content/admin/pages/" + page.id, { method: "DELETE", headers: headers() });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? "Page could not be deleted.");
      if (pageId === page.id) startNewPage();
      await load(); setMessage("Page deleted.");
    } catch (failure: any) { setError(failure.message ?? "Page could not be deleted."); }
  }

  async function uploadFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    setBusy(true); setError(""); setMessage("");
    try {
      for (const file of files) {
        const image = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type);
        const video = ["video/mp4", "video/webm"].includes(file.type);
        if ((!image && !video) || file.size > (image ? 20 : 100) * 1024 * 1024) {
          throw new Error("Use JPEG, PNG, WebP, GIF up to 20 MB, or MP4/WebM up to 100 MB.");
        }
        const response = await fetch("/api/owner-content/admin/media/upload", {
          method: "POST",
          headers: { ...headers(), "Content-Type": file.type, "X-File-Name": encodeURIComponent(file.name) },
          body: file,
        });
        await responseData(response);
      }
      await load(); setMessage("Media uploaded and available to this website.");
    } catch (failure: any) {
      setError(failure.message ?? "Media upload failed.");
    } finally {
      setBusy(false); input.value = "";
    }
  }

  async function updateMedia(item: any, changes: Record<string, unknown>) {
    setError(""); setMessage("");
    try {
      await responseData(await fetch("/api/owner-content/admin/media/" + item.id, {
        method: "PATCH", headers: { ...headers(), "Content-Type": "application/json" }, body: JSON.stringify(changes),
      }));
      await load(); setMessage("Media details saved.");
    } catch (failure: any) { setError(failure.message ?? "Media details could not be saved."); }
  }

  async function deleteMedia(item: any) {
    if (!window.confirm("Delete " + item.name + " from this website?")) return;
    setError(""); setMessage("");
    try {
      const response = await fetch("/api/owner-content/admin/media/" + item.id, { method: "DELETE", headers: headers() });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? "Media could not be deleted.");
      await load(); setMessage("Media deleted.");
    } catch (failure: any) { setError(failure.message ?? "Media could not be deleted."); }
  }

  return <div style={{ maxWidth: 1100 }}>
    <h2 style={{ fontSize: "1.5rem", margin: "0 0 .4rem" }}>Website pages and media</h2>
    <p style={{ color: "#94a3b8", marginTop: 0 }}>Manage this website’s custom pages and public media. Draft pages are not visible to visitors.</p>
    {error && <p role="alert" style={{ color: "#f87171" }}>{error}</p>}
    {message && <p role="status" style={{ color: "#34d399" }}>{message}</p>}
    <section style={card} aria-label="Custom page manager">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>Custom pages</h3>
        <button type="button" onClick={startNewPage}>New page</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) minmax(280px, 2fr)", gap: 16, marginTop: 12 }}>
        <div>
          {pages.length ? pages.map(page => <div key={page.id} style={{ borderTop: "1px solid #334155", padding: ".65rem 0" }}>
            <button type="button" onClick={() => selectPage(page)} style={{ background: "none", color: "#e2e8f0", border: 0, cursor: "pointer", textAlign: "left" }}>
              <strong>{page.title}</strong><span style={{ display: "block", color: "#94a3b8", fontSize: ".8rem" }}>/pages/{page.slug} · {page.status}</span>
            </button>
            <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
              <button type="button" onClick={() => void togglePage(page)}>{page.status === "published" ? "Unpublish" : "Publish"}</button>
              <button type="button" onClick={() => void deletePage(page)}>Delete</button>
              {page.status === "published" && <a href={"/pages/" + encodeURIComponent(page.slug)} target="_blank" rel="noreferrer">Preview</a>}
            </div>
          </div>) : <p style={{ color: "#94a3b8" }}>No custom pages yet.</p>}
        </div>
        <form onSubmit={savePage}>
          <h4 style={{ margin: "0 0 .6rem" }}>{pageId ? "Edit page" : "Create a page"}</h4>
          <input style={field} aria-label="Page title" placeholder="Page title" maxLength={160} required value={pageDraft.title} onChange={event => setPageDraft({ ...pageDraft, title: event.target.value })} />
          <input style={field} aria-label="Page URL slug" placeholder="URL slug" maxLength={80} required value={pageDraft.slug} onChange={event => setPageDraft({ ...pageDraft, slug: event.target.value })} />
          <textarea style={{ ...field, minHeight: 180, resize: "vertical" }} aria-label="Page content" placeholder="Plain text page copy; line breaks are preserved." maxLength={40000} value={pageDraft.content} onChange={event => setPageDraft({ ...pageDraft, content: event.target.value })} />
          <input style={field} aria-label="SEO title" placeholder="SEO title (optional)" maxLength={180} value={pageDraft.seoTitle} onChange={event => setPageDraft({ ...pageDraft, seoTitle: event.target.value })} />
          <textarea style={{ ...field, minHeight: 65, resize: "vertical" }} aria-label="SEO description" placeholder="SEO description (optional)" maxLength={320} value={pageDraft.seoDescription} onChange={event => setPageDraft({ ...pageDraft, seoDescription: event.target.value })} />
          <select style={field} aria-label="Publication status" value={pageDraft.status} onChange={event => setPageDraft({ ...pageDraft, status: event.target.value })}><option value="draft">Draft</option><option value="published">Published</option></select>
          <button type="submit" disabled={busy}>{busy ? "Saving…" : pageId ? "Save page" : "Create page"}</button>
        </form>
      </div>
    </section>
    <section style={card} aria-label="Owner media library">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div><h3 style={{ margin: 0 }}>Media library</h3><p style={{ color: "#94a3b8", fontSize: ".82rem" }}>Uploaded images and videos are website-scoped and remain available through their public asset URL.</p></div>
        <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" aria-label="Upload images or videos" onChange={event => void uploadFiles(event)} />
      </div>
      {!media.length ? <p style={{ color: "#94a3b8" }}>No media files yet.</p> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 12, marginTop: 12 }}>
        {media.map(item => <article key={item.id} style={{ border: "1px solid #334155", borderRadius: 9, padding: 10, minWidth: 0 }}>
          {item.mediaType === "image" ? <img src={item.url} alt={item.caption || item.name} style={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 6, background: "#0f172a" }} /> : <video src={item.url} controls preload="metadata" style={{ width: "100%", height: 150, borderRadius: 6, background: "#0f172a" }} />}
          <p style={{ color: "#94a3b8", fontSize: ".75rem", overflowWrap: "anywhere" }}>Public URL: {item.url}</p>
          <input style={field} aria-label={"Media name " + item.id} defaultValue={item.name} maxLength={255} />
          <input style={field} aria-label={"Media caption " + item.id} defaultValue={item.caption ?? ""} maxLength={500} placeholder="Caption (optional)" />
          <button type="button" onClick={event => {
            const root = (event.currentTarget.parentElement as HTMLElement);
            const inputs = root.querySelectorAll("input");
            void updateMedia(item, { name: inputs[0]?.value, caption: inputs[1]?.value || null });
          }}>Save details</button>
          <button type="button" onClick={() => void deleteMedia(item)} style={{ marginLeft: 8 }}>Delete</button>
        </article>)}
      </div>}
    </section>
  </div>;
}
