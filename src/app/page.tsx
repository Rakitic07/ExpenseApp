import Spendly from "@/components/Spendly";

// The landing shell needs no server data — it's a client app that fetches auth
// state and expenses at runtime. Keeping this page static lets Vercel serve the
// HTML from its CDN instantly (no serverless cold start on every visit).
export default function Home() {
  return <Spendly />;
}
