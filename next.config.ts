import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O botão "N" do Next em dev ficava no canto inferior esquerdo, exatamente onde fica o logo do Deezer
  // (exigência da API), cobrindo-o. Só esconde o botão; os overlays de erro continuam funcionando.
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Permite abrir o app em dev pelo IP da rede local (celulares). Sem isso o Next bloqueia
  // os scripts de outros hosts e a página não hidrata (botões/inputs inertes).
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*", "10.*.*.*", "172.*.*.*"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
