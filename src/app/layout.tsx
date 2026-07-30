import type { Metadata } from "next";
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Casa Clara · Tu hogar, en orden",
  description:
    "Gastos, tareas, compras y balances compartidos en una aplicación sencilla para el día a día.",
  openGraph: {
    title: "Casa Clara",
    description: "Tu hogar, en orden.",
    type: "website",
    locale: "es_ES",
    images: [
      {
        url: "/og.png",
        width: 1733,
        height: 907,
        alt: "Casa Clara: gastos, compras y tareas del hogar en un mismo lugar",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Casa Clara",
    description: "Tu hogar, en orden.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
