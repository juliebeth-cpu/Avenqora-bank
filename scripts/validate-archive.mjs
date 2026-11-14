import { readFile, readdir } from "node:fs/promises";
 import { createHash } from "node:crypto";
 const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
 const required = [...["README.md","package.json",".env.example","Dockerfile","docker-compose.yml",".dockerignore",".gitignore","tsconfig.json","tsconfig.server.json","vite.config.ts","drizzle.config.ts","tailwind.config.js","postcss.config.js","server/index.ts","server/db.ts","server/auth.ts","server/schema.ts","server/email.ts","server/tracking.ts","server/routes/email.ts","server/routes/auth.ts","server/routes/portal.ts","server/routes/customer.ts","server/routes/features.ts","server/routes/workflows.ts","server/routes/banking.ts","server/routes/owner-content.ts","scripts/validate-archive.mjs","database/seed.ts","database/tenant-snapshot.json","database/website-config.json","client/index.html","client/src/main.tsx","client/src/index.css","client/src/config.ts","client/src/App.tsx","client/src/pages/PublicHome.tsx","client/src/pages/InformationalPage.tsx","client/src/pages/AdminLogin.tsx","client/src/pages/AdminDashboard.tsx","client/src/pages/CustomerPortal.tsx","client/src/pages/BankingActions.tsx","client/src/pages/OwnerContentManager.tsx","manifest.json"], ...(manifest.website?.type === "banking" ? ["server/routes/deposits.ts","client/src/pages/BankingDepositFlow.tsx","client/src/pages/BankingDepositsAdmin.tsx","client/src/pages/PublicBankingHome.tsx","client/src/pages/PromoVideoEmbed.tsx","client/src/pages/homepage-copy.ts","client/src/components/AssetSlideshow.tsx","client/src/components/website-logo.tsx","package-lock.json"] : [])];
 const safe = (name) => typeof name === "string" && name.length > 0 && !name.startsWith("/") && !name.includes("\\") && !name.split("/").includes("..");
 const generated = manifest.contents?.generatedFiles;
 if (!Array.isArray(generated) || new Set(generated).size !== generated.length) throw new Error("manifest generatedFiles is invalid");
 for (const name of required) if (!generated.includes(name)) throw new Error("required file is missing from manifest: " + name);
 const files = [];
 async function walk(dir, prefix = "") {
   for (const entry of await readdir(dir, { withFileTypes: true })) {
     if (entry.isDirectory() && ["node_modules", "dist", ".git"].includes(entry.name)) continue;
     const name = prefix ? prefix + "/" + entry.name : entry.name;
     if (entry.isDirectory()) await walk(dir + "/" + entry.name, name);
     else files.push(name);
   }
 }
 await walk(".");
  const actualFiles = new Set(files.filter((name) =>
    name !== "manifest.json" &&
    (name !== "package-lock.json" || generated.includes(name)) &&
    name !== "pnpm-lock.yaml" &&
    name !== ".env" &&
    !name.endsWith(".log")
  ));
 for (const name of generated) {
   if (!safe(name)) throw new Error("unsafe archive path: " + name);
   await readFile(name);
   if (name === "manifest.json") continue;
   const actual = createHash("sha256").update(await readFile(name)).digest("hex");
   if (actual !== manifest.contents.checksums?.[name]) throw new Error("checksum mismatch: " + name);
   if (!actualFiles.has(name)) throw new Error("manifest contains a file that is not on disk: " + name);
 }
 for (const name of actualFiles) if (!generated.includes(name)) throw new Error("unlisted archive file: " + name);
 if (!manifest.contents.dataSnapshot.tables.length) throw new Error("snapshot has no scoped tables");
 const snapshot = JSON.parse(await readFile("database/tenant-snapshot.json", "utf8"));
 for (const [table, count] of Object.entries(manifest.contents.dataSnapshot.rowCounts ?? {})) {
   if ((snapshot.tables?.[table]?.rows?.length ?? -1) !== count) throw new Error("snapshot row count mismatch: " + table);
 }
 const config = JSON.parse(await readFile("database/website-config.json", "utf8"));
 if (!config.email?.mainSystem || !config.email?.customerSupport || !config.email?.templates) throw new Error("website email configuration is missing");
 const forbidden = /(?:password|smtp_pass|secret|token|api[_-]?key|private[_-]?key)/i;
 if (forbidden.test(JSON.stringify(config.email))) throw new Error("secret-like value found in exported email configuration");
  const copiedAssetPaths = new Set();
  for (const asset of manifest.contents.assets?.copied ?? []) {
    const local = "client/public" + asset.path;
    const body = await readFile(local);
    const checksum = createHash("sha256").update(body).digest("hex");
    if (checksum !== asset.checksum) throw new Error("copied asset checksum mismatch: " + local);
    copiedAssetPaths.add(asset.path);
  }
   const privateAssetPaths = new Set();
   for (const asset of manifest.contents.assets?.private ?? []) {
     if (!asset.path.startsWith("/_private-assets/")) throw new Error("invalid private asset path: " + asset.path);
     const local = "private-assets" + asset.path.slice("/_private-assets".length);
     const body = await readFile(local);
     const checksum = createHash("sha256").update(body).digest("hex");
     if (checksum !== asset.checksum) throw new Error("private KYC asset checksum mismatch: " + local);
     if (copiedAssetPaths.has(asset.path)) throw new Error("private KYC asset is exposed as a public asset: " + asset.path);
     privateAssetPaths.add(asset.path);
   }
  const assetReferences = new Set();
   const privateAssetReferences = new Set();
  const unresolvedObjectReferences = new Set();
  function inspectReferences(value) {
    if (typeof value === "string") {
      if (value.startsWith("/assets/")) assetReferences.add(value);
       else if (value.startsWith("/_private-assets/")) privateAssetReferences.add(value);
      else if (value.includes("/objects/") || value.includes("/api/public/logo-objects/")) unresolvedObjectReferences.add(value);
      return;
    }
    if (Array.isArray(value)) return value.forEach(inspectReferences);
    if (value && typeof value === "object") Object.values(value).forEach(inspectReferences);
  }
  inspectReferences(snapshot);
  inspectReferences(config);
  const websiteSources = [
    "client/src/config.ts",
    "client/src/pages/PublicHome.tsx",
    ...(manifest.website?.type === "banking" ? [
      "client/src/pages/PublicBankingHome.tsx",
      "client/src/pages/BankingDepositFlow.tsx",
      "client/src/pages/BankingDepositsAdmin.tsx",
      "client/src/components/AssetSlideshow.tsx",
    ] : []),
  ];
  for (const runtimeFile of websiteSources) {
    const source = await readFile(runtimeFile, "utf8");
    if (source.includes("/objects/") || source.includes("/api/public/logo-objects/")) throw new Error("generated website source retains an original object-storage reference: " + runtimeFile);
    for (const match of source.match(/["'](\/assets\/[^"']+)["']/g) ?? []) assetReferences.add(match.slice(1, -1));
  }
  if (unresolvedObjectReferences.size) throw new Error("exported data retains an original object-storage reference: " + Array.from(unresolvedObjectReferences)[0]);
  for (const reference of assetReferences) {
    if (!copiedAssetPaths.has(reference)) throw new Error("website data references an asset that is not listed as copied: " + reference);
    await readFile("client/public" + reference);
  }
  for (const reference of privateAssetReferences) {
    if (!privateAssetPaths.has(reference)) throw new Error("website data references an unlisted private KYC asset: " + reference);
    await readFile("private-assets" + reference.slice("/_private-assets".length));
  }
 for (const requiredRuntime of ["server/index.ts", "server/auth.ts", "server/routes/auth.ts", "server/routes/features.ts", "server/routes/banking.ts", "server/routes/owner-content.ts", ...(manifest.website?.type === "banking" ? ["server/routes/deposits.ts"] : [])]) {
   const source = await readFile(requiredRuntime, "utf8");
   if (/@workspace\/|danzy\\.app|replit\\.(dev|app)/i.test(source)) throw new Error("standalone runtime references a master or Replit dependency: " + requiredRuntime);
 }
 if (manifest.security?.tenantIsolated !== true || manifest.security?.passwordsExported === true || manifest.security?.tokensExported === true) throw new Error("standalone security contract is invalid");
  if (!manifest.requiredEnvVars.includes("DATABASE_URL") || !manifest.requiredEnvVars.includes("SESSION_SECRET")) throw new Error("database/auth deployment requirements missing");
  if (!manifest.requiredEnvVars.includes("PUBLIC_BASE_URL")) throw new Error("canonical public URL requirement missing");
 if (!manifest.requiredEnvVars.includes("UPLOAD_DIR")) throw new Error("persistent upload storage requirement missing");
  if (!["BOOTSTRAP_ADMIN_USERNAME", "BOOTSTRAP_ADMIN_EMAIL", "BOOTSTRAP_ADMIN_PASSWORD"].every((name) => manifest.bootstrapEnvVars?.includes(name))) throw new Error("administrator bootstrap requirements missing");
  if (!["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"].every((name) => manifest.optionalEnvVars?.includes(name))) throw new Error("optional SMTP requirements missing");
  if (manifest.externalDependencies?.database?.status !== "required" || manifest.externalDependencies?.uploads?.status !== "required" || manifest.externalDependencies?.sourceMedia?.status !== "export_time_only" || manifest.externalDependencies?.email?.status !== "optional" || manifest.externalDependencies?.payments?.status !== "not_integrated" || manifest.externalDependencies?.marketData?.status !== "simulated" || manifest.externalDependencies?.liveChat?.status !== "optional_external") throw new Error("external dependency disclosure is missing or invalid");
 process.stdout.write("Archive validation passed\\n");
 