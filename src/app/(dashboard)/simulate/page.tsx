import { SimulatorPanel } from "@/components/simulation/SimulatorPanel";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Simulate",
};

export default function SimulatePage() {
  return (
    <div className="h-full">
      <SimulatorPanel />
    </div>
  );
}
