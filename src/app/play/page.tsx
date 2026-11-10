import type { Metadata } from "next";
import { ControllerScreen } from "@/features/controller/components/controller-screen";

export const metadata: Metadata = { title: "BeatRush Party · Controle" };

export default async function PlayPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return <ControllerScreen initialCode={code} />;
}
