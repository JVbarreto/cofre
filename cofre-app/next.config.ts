import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Aplica em todas as rotas
        source: "/(.*)",
        headers: [
          // Impede que a página seja embutida em iframes de outros domínios (clickjacking)
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // Impede navegadores de fazerem MIME-type sniffing
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Não envia o Referer para sites externos
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Desativa features de browser desnecessárias
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // Força HTTPS por 1 ano (só entra em vigor em produção com HTTPS)
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Content Security Policy
          // - default-src 'self': bloqueia tudo que não seja do próprio domínio por padrão
          // - script-src: permite scripts do próprio domínio + 'unsafe-inline' (necessário para Next.js)
          // - connect-src: permite conexões com o Supabase (API + realtime)
          // - img-src: permite imagens do próprio domínio + data URIs (avatares base64)
          // - style-src 'unsafe-inline': necessário para estilos inline usados no app
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              `connect-src 'self' ${supabaseUrl} wss://${supabaseUrl.replace("https://", "")}`,
              "img-src 'self' data: blob:",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

