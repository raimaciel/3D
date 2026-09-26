import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestão 3D | Produção e negócios",
  description: "Orçamentos, produção, materiais e financeiro para impressão 3D.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon-custom.svg",
    shortcut: "/favicon-custom.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
