import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Casa Clara",
    short_name: "Casa Clara",
    description: "Gastos, tareas, compras y balances compartidos.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4ed",
    theme_color: "#315c49",
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
      {
        src: "/icons/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
