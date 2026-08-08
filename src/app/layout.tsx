import type { Metadata, Viewport } from "next";
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  applicationName: "Casa Clara",
  title: "Casa Clara · Tu hogar, en orden",
  description:
    "Gastos, tareas, compras y balances compartidos en una aplicación sencilla para el día a día.",
<<<<<<< HEAD
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      {
        url: "/icons/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        url: "/icons/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/icons/favicon-48x48.png",
        sizes: "48x48",
        type: "image/png",
      },
      {
        url: "/icons/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
    shortcut: "/icons/favicon-32x32.png",
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Casa Clara",
  },
  formatDetection: {
    telephone: false,
=======
  applicationName: "Casa Clara",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Casa Clara",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
>>>>>>> 0f06c5daab478e5323d9e28d7ac6ffe32cb87aeb
  },
  openGraph: {
    title: "Casa Clara",
    description: "Tu hogar, en orden.",
    type: "website",
    locale: "es_ES",
    images: [
      {
        url: "/og-v2.png",
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
    images: ["/og-v2.png"],
  },
};

export const viewport: Viewport = {
<<<<<<< HEAD
  themeColor: "#30483b",
=======
  themeColor: "#315c49",
>>>>>>> 0f06c5daab478e5323d9e28d7ac6ffe32cb87aeb
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
