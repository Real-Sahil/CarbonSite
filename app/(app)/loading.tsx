import { EcoLoader } from "@/components/brand/eco-loader";

// Shown while the app shell and the organisation layout load (sign-in
// redirect, membership and branding checks), instead of a blank page.
export default function Loading() {
  return <EcoLoader fullScreen />;
}
