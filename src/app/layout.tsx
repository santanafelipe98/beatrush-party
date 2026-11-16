import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import { AnalyticsProvider } from "@/components/analytics/analytics-provider";
import { parseGaId } from "@/components/analytics/ga-id";
import { I18nProvider } from "@/lib/i18n/provider";
import { getLocale, getTranslator } from "@/lib/i18n/server";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: "BeatRush Party", description: t("app.tagline") };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#08080b",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${montserrat.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <I18nProvider initialLocale={locale}>
          {/* ID lido em runtime (a página é dinâmica): trocar o ID não exige novo build */}
          <AnalyticsProvider gaId={parseGaId(process.env.GA_MEASUREMENT_ID)}>{children}</AnalyticsProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
