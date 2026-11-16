import { AppShell } from "./AppShell";
import { registerServiceWorker } from "@/lib/registerSw";

registerServiceWorker();

export default function App() {
  return <AppShell />;
}
