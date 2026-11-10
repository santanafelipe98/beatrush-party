import type { Metadata } from "next";
import { HostScreen } from "@/features/host/components/host-screen";

export const metadata: Metadata = { title: "BeatRush Party · TV" };

export default function HostPage() {
  return <HostScreen />;
}
