import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { readExecutionProfile } from "./scripts/execution-profile.mjs";
import { sites } from "./build/sites-vite-plugin";

const { d1, r2 } = hostingConfig;

// Para onde isto publica: os recursos reais da conta Cloudflare da Fabricando
// 3D, criados em 26/09/2026. O id do banco NÃO é segredo — é só um
// identificador, e ninguém alcança o banco sem estar autenticado na conta.
// Deixá-lo aqui evita ter que configurar variável de build no painel.
// O .env sobrepõe qualquer um destes, para quem precisar publicar noutro lugar.
// O projeto na Cloudflare foi criado com o nome "3d", e o wrangler publica com
// o nome que estiver AQUI. Se os dois divergirem, nasce um segundo Worker e a
// tela de builds passa a mostrar um que não é o que está no ar. Mantenha igual
// ao nome do projeto no painel. O endereço público será fabricando3d.com.br de
// qualquer forma, então este nome é só interno.
const nomeWorker = process.env.CF_WORKER_NAME || "3d";
const nomeBanco = process.env.CF_D1_NOME || "fabricando3d";
const idBanco = process.env.CF_D1_ID || "50c8c520-3ebe-447f-8502-10429660a661";
const nomeBucket = process.env.CF_R2_BUCKET || "fabricando3d-arquivos";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const managedLinux = readExecutionProfile() === "managed-linux";

const localBindingConfig = {
  name: nomeWorker,
  main: "vinext/server/fetch-handler",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [{ binding: d1, database_name: nomeBanco, database_id: idBanco }]
    : [],
  r2_buckets: r2 ? [{ binding: r2, bucket_name: nomeBucket }] : [],
};

export default defineConfig(async () => {
  // Use Miniflare's local Request.cf placeholder unless fetching is requested.
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      ...(managedLinux ? { host: "0.0.0.0", allowedHosts: ["terminal.local"] } : {}),
      ...(isCodexSeatbeltSandbox ? { watch: { useFsEvents: false, usePolling: true } } : {}),
    },
    plugins: [
      vinext(),
      sites({ mockAuth: !managedLinux }),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});
