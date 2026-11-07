import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getSession } from "@/lib/auth";
import { SwRegister } from "@/components/SwRegister";
import { FxProvider } from "@/components/Fx";

export const metadata: Metadata = {
  title: { default: "KNOWPLAY – Play smart. Learn more.", template: "%s · KNOWPLAY" },
  description: "Kunskapsspel för elever 13–18. Spela, lär dig och tävla med klassen – utan pengar, utan lootboxar.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "KNOWPLAY", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};
export async function generateViewport(): Promise<Viewport> {
  const { profile } = await getSession();
  const light = profile?.theme === "ljus";
  return { themeColor: light ? "#f4f1e8" : "#121815", width: "device-width", initialScale: 1, viewportFit: "cover" };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getSession();
  const theme = profile?.theme ?? "noir";
  const anim = profile?.settings?.animations === false ? "off" : "on";
  return (
    <html lang="sv" data-theme={theme} data-anim={anim}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;800&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <FxProvider sound={profile?.settings?.sound ?? true} haptics={profile?.settings?.haptics ?? true}>
          {children}
        </FxProvider>
        <SwRegister />
      </body>
    </html>
  );
}
