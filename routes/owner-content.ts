import express, { Router } from "express";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "../db.js";
import { requireAdmin } from "../auth.js";

const router = Router();
const websiteId = 10;
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const videoTypes = new Set(["video/mp4", "video/webm"]);
const safeSegments = (value: string) => {
  const parts = value.split("/");
  return parts.length > 0 && parts.every((part) => /^[A-Za-z0-9._-]+$/.test(part) && part !== "." && part !== "..") ? parts : null;
};
const tableExists = async (table: string) => {
  const result = await pool.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1 LIMIT 1", [table]);
  return Number(result.rowCount ?? 0) > 0;
};
const audit = async (action: string, resource: string, id: number, req: any, details: Record<string, unknown> = {}) => {
  if (!await tableExists("audit_logs")) return;
  await pool.query(
    "INSERT INTO audit_logs (website_id,user_id,user_type,action,resource_type,resource_id,details,created_at) VALUES ($1,$2,'website_admin',$3,$4,$5,$6::jsonb,NOW())",
    [websiteId, Number(req.admin?.userId) || null, action, resource, id, JSON.stringify(details)],
  ).catch(() => undefined);
};
const shapePage = (row: any) => ({
  id: row.id, title: row.title, slug: row.slug, content: row.content, status: row.status,
  seoTitle: row.seo_title, seoDescription: row.seo_description,
  createdAt: row.created_at, updatedAt: row.updated_at,
});
const shapeMedia = (row: any) => ({
  id: row.id, name: row.name, contentType: row.content_type, mediaType: row.media_type,
  fileSize: row.file_size, caption: row.caption, status: row.status,
  canDelete: true, url: "/api/owner-content/public/media/" + encodeURIComponent(String(row.id)),
  createdAt: row.created_at,
});
const parsePage = (input: any, partial = false) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const output: Record<string, unknown> = {};
  const textField = (key: string, max: number, required: boolean, pattern?: RegExp) => {
    if (!(key in input)) return !required || partial;
    const value = input[key];
    if (typeof value !== "string") return false;
    const clean = value.trim();
    if (required && !clean) return false;
    if (clean.length > max || (pattern && clean && !pattern.test(clean))) return false;
    output[key] = clean;
    return true;
  };
  if (!textField("title", 160, !partial)) return null;
  if (!textField("slug", 80, !partial, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)) return null;
  if ("content" in input || !partial) {
    if (typeof input.content !== "string" || input.content.length > 40000) return null;
    output.content = input.content;
  }
  if ("status" in input) {
    if (input.status !== "draft" && input.status !== "published") return null;
    output.status = input.status;
  } else if (!partial) output.status = "draft";
  for (const [key, max] of [["seoTitle", 180], ["seoDescription", 320]] as const) {
    if (!(key in input)) continue;
    if (input[key] !== null && (typeof input[key] !== "string" || input[key].length > max)) return null;
    output[key] = typeof input[key] === "string" ? input[key].trim() || null : null;
  }
  return Object.keys(output).length ? output : null;
};
const pageColumns: Record<string, string> = {
  title: "title", slug: "slug", content: "content", status: "status",
  seoTitle: "seo_title", seoDescription: "seo_description",
};

router.get("/public/pages", async (_req, res) => {
  if (!await tableExists("website_owner_pages")) { res.json({ pages: [] }); return; }
  const result = await pool.query(
    "SELECT title,slug FROM website_owner_pages WHERE website_id=$1 AND status='published' ORDER BY title",
    [websiteId],
  );
  res.json({ pages: result.rows });
});
router.get("/public/pages/:slug", async (req, res) => {
  if (!await tableExists("website_owner_pages")) { res.status(404).json({ error: "Page not found" }); return; }
  const result = await pool.query(
    "SELECT title,slug,content,seo_title,seo_description FROM website_owner_pages WHERE website_id=$1 AND slug=$2 AND status='published' LIMIT 1",
    [websiteId, String(req.params.slug ?? "")],
  );
  const page = result.rows[0];
  if (!page) { res.status(404).json({ error: "Page not found" }); return; }
  res.json({ title: page.title, slug: page.slug, content: page.content, seoTitle: page.seo_title, seoDescription: page.seo_description });
});

router.get("/admin/pages", requireAdmin, async (_req, res) => {
  if (!await tableExists("website_owner_pages")) { res.json({ pages: [] }); return; }
  const result = await pool.query("SELECT * FROM website_owner_pages WHERE website_id=$1 ORDER BY updated_at DESC", [websiteId]);
  res.json({ pages: result.rows.map(shapePage) });
});
router.post("/admin/pages", requireAdmin, async (req: any, res) => {
  if (!await tableExists("website_owner_pages")) { res.status(503).json({ error: "Custom pages are not configured" }); return; }
  const page = parsePage(req.body);
  if (!page) { res.status(400).json({ error: "Invalid page data" }); return; }
  try {
    const result = await pool.query(
      "INSERT INTO website_owner_pages (website_id,title,slug,content,status,seo_title,seo_description,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) RETURNING *",
      [websiteId, page.title, page.slug, page.content, page.status, page.seoTitle ?? null, page.seoDescription ?? null],
    );
    const created = result.rows[0];
    await audit("owner_create_page", "website_owner_page", created.id, req, { title: created.title, slug: created.slug, status: created.status });
    res.status(201).json(shapePage(created));
  } catch (error: any) {
    if (error?.code === "23505") { res.status(409).json({ error: "A page with this URL slug already exists" }); return; }
    res.status(500).json({ error: "Page could not be created" });
  }
});
router.patch("/admin/pages/:id", requireAdmin, async (req: any, res) => {
  if (!await tableExists("website_owner_pages")) { res.status(503).json({ error: "Custom pages are not configured" }); return; }
  const id = Number(req.params.id);
  const page = parsePage(req.body, true);
  if (!Number.isSafeInteger(id) || id < 1 || !page) { res.status(400).json({ error: "Invalid page update" }); return; }
  const entries = Object.entries(page).filter(([key]) => pageColumns[key]);
  const assignments = entries.map(([key], index) => pageColumns[key] + "=$" + (index + 1));
  const values = entries.map(([, value]) => value);
  assignments.push("updated_at=NOW()");
  values.push(id, websiteId);
  try {
    const result = await pool.query(
      "UPDATE website_owner_pages SET " + assignments.join(",") + " WHERE id=$" + (values.length - 1) + " AND website_id=$" + values.length + " RETURNING *",
      values,
    );
    const updated = result.rows[0];
    if (!updated) { res.status(404).json({ error: "Page not found" }); return; }
    await audit("owner_update_page", "website_owner_page", id, req, { fields: entries.map(([key]) => key), slug: updated.slug });
    res.json(shapePage(updated));
  } catch (error: any) {
    if (error?.code === "23505") { res.status(409).json({ error: "A page with this URL slug already exists" }); return; }
    res.status(500).json({ error: "Page could not be updated" });
  }
});
router.delete("/admin/pages/:id", requireAdmin, async (req: any, res) => {
  if (!await tableExists("website_owner_pages")) { res.status(503).json({ error: "Custom pages are not configured" }); return; }
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ error: "Invalid page id" }); return; }
  const result = await pool.query("DELETE FROM website_owner_pages WHERE id=$1 AND website_id=$2 RETURNING id,title", [id, websiteId]);
  if (!result.rowCount) { res.status(404).json({ error: "Page not found" }); return; }
  await audit("owner_delete_page", "website_owner_page", id, req, { title: result.rows[0].title });
  res.sendStatus(204);
});

router.get("/admin/media", requireAdmin, async (_req, res) => {
  if (!await tableExists("website_owner_media")) { res.json({ media: [] }); return; }
  const result = await pool.query("SELECT * FROM website_owner_media WHERE website_id=$1 AND status='active' ORDER BY created_at DESC", [websiteId]);
  res.json({ media: result.rows.map(shapeMedia) });
});
router.post("/admin/media/upload", requireAdmin, express.raw({
  type: [...imageTypes, ...videoTypes], limit: "100mb",
}), async (req: any, res) => {
  if (!await tableExists("website_owner_media")) { res.status(503).json({ error: "Media library is not configured" }); return; }
  const contentType = String(req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  const isImage = imageTypes.has(contentType);
  const isVideo = videoTypes.has(contentType);
  const maxBytes = isImage ? 20 * 1024 * 1024 : 100 * 1024 * 1024;
  const body = req.body;
  let name = "";
  try { name = decodeURIComponent(String(req.headers["x-file-name"] ?? "")).split(/[\\/]/).pop()?.trim() ?? ""; } catch {}
  if ((!isImage && !isVideo) || !Buffer.isBuffer(body) || !body.length || body.length > maxBytes || !name || name.length > 255 || /[\u0000-\u001f]/.test(name)) {
    res.status(400).json({ error: "Upload a supported JPEG, PNG, WebP, GIF, MP4, or WebM file within its size limit." }); return;
  }
  const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/webm": "webm" };
  const fileName = randomUUID() + "." + extensions[contentType];
  const relative = ["owner-media", String(websiteId), fileName];
  const uploadRoot = path.resolve(process.env.UPLOAD_DIR || "data/uploads");
  const filePath = path.resolve(uploadRoot, ...relative);
  if (!filePath.startsWith(uploadRoot + path.sep)) { res.status(400).json({ error: "Invalid upload path" }); return; }
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, body, { flag: "wx" });
  const objectPath = "/_standalone-assets/" + relative.join("/");
  try {
    const result = await pool.query(
      "INSERT INTO website_owner_media (website_id,name,object_path,content_type,media_type,file_size,caption,status,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,NULL,'active',NOW(),NOW()) RETURNING *",
      [websiteId, name, objectPath, contentType, isImage ? "image" : "video", body.length],
    );
    await audit("owner_upload_media", "website_owner_media", result.rows[0].id, req, { mediaType: isImage ? "image" : "video" });
    res.status(201).json(shapeMedia(result.rows[0]));
  } catch (error) {
    await unlink(filePath).catch(() => undefined);
    if ((error as any)?.code === "23505") { res.status(409).json({ error: "This media object already exists" }); return; }
    res.status(500).json({ error: "Could not save media metadata" });
  }
});
router.patch("/admin/media/:id", requireAdmin, async (req: any, res) => {
  if (!await tableExists("website_owner_media")) { res.status(503).json({ error: "Media library is not configured" }); return; }
  const id = Number(req.params.id);
  const name = req.body?.name;
  const caption = req.body?.caption;
  if (!Number.isSafeInteger(id) || id < 1 || (name === undefined && caption === undefined)
    || (name !== undefined && (typeof name !== "string" || !name.trim() || name.trim().length > 255))
    || (caption !== undefined && caption !== null && (typeof caption !== "string" || caption.length > 500))) {
    res.status(400).json({ error: "Provide a valid name or caption" }); return;
  }
  const result = await pool.query(
    "UPDATE website_owner_media SET name=COALESCE($1,name),caption=CASE WHEN $2::boolean THEN $3::text ELSE caption END,updated_at=NOW() WHERE id=$4 AND website_id=$5 AND status='active' RETURNING *",
    [name === undefined ? null : name.trim(), caption !== undefined, caption ?? null, id, websiteId],
  );
  if (!result.rows[0]) { res.status(404).json({ error: "Media item not found" }); return; }
  await audit("owner_update_media", "website_owner_media", id, req, { nameChanged: name !== undefined, captionChanged: caption !== undefined });
  res.json(shapeMedia(result.rows[0]));
});
router.delete("/admin/media/:id", requireAdmin, async (req: any, res) => {
  if (!await tableExists("website_owner_media")) { res.status(503).json({ error: "Media library is not configured" }); return; }
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ error: "Invalid media id" }); return; }
  const result = await pool.query("DELETE FROM website_owner_media WHERE id=$1 AND website_id=$2 RETURNING id,object_path,media_type", [id, websiteId]);
  const item = result.rows[0];
  if (!item) { res.status(404).json({ error: "Media item not found" }); return; }
  const prefix = "/_standalone-assets/owner-media/" + websiteId + "/";
  if (typeof item.object_path === "string" && item.object_path.startsWith(prefix)) {
    const name = item.object_path.slice(prefix.length);
    if (/^[A-Za-z0-9-]+\.(jpg|png|webp|gif|mp4|webm)$/.test(name)) {
      const uploadRoot = path.resolve(process.env.UPLOAD_DIR || "data/uploads");
      await unlink(path.join(uploadRoot, "owner-media", String(websiteId), name)).catch(() => undefined);
    }
  }
  await audit("owner_delete_media", "website_owner_media", id, req, { mediaType: item.media_type });
  res.sendStatus(204);
});
router.get("/public/media/:id", async (req, res) => {
  if (!await tableExists("website_owner_media")) { res.status(404).json({ error: "Media not found" }); return; }
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) { res.status(404).json({ error: "Media not found" }); return; }
  const result = await pool.query(
    "SELECT object_path,content_type,status FROM website_owner_media WHERE id=$1 AND website_id=$2 AND status='active' LIMIT 1",
    [id, websiteId],
  );
  const item = result.rows[0];
  if (!item) { res.status(404).json({ error: "Media not found" }); return; }
  const allowedTypes = new Set([...imageTypes, ...videoTypes]);
  if (!allowedTypes.has(item.content_type)) { res.status(415).json({ error: "Unsupported media type" }); return; }
  let filePath: string | null = null;
  const objectPath = String(item.object_path ?? "");
  const uploadPrefix = "/_standalone-assets/owner-media/" + websiteId + "/";
  if (objectPath.startsWith(uploadPrefix)) {
    const parts = safeSegments(objectPath.slice(uploadPrefix.length));
    if (parts?.length === 1) filePath = path.resolve(process.env.UPLOAD_DIR || "data/uploads", "owner-media", String(websiteId), ...parts);
  } else if (objectPath.startsWith("/assets/")) {
    const parts = safeSegments(objectPath.slice("/assets/".length));
    if (parts) filePath = path.resolve(process.cwd(), "client", "public", "assets", ...parts);
  }
  if (!filePath) { res.status(404).json({ error: "Media file is unavailable" }); return; }
  try {
    const body = await readFile(filePath);
    res.setHeader("Content-Type", item.content_type);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(body);
  } catch {
    res.status(404).json({ error: "Media file is unavailable" });
  }
});

export default router;
