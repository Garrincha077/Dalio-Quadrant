import { loadDashboard } from "../lib/fred.mjs";
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.FRED_API_KEY) {
    res.setHeader("Cache-Control", "no-store");
    return res
      .status(503)
      .json({
        error: "FRED is not configured. Add FRED_API_KEY on the server.",
      });
  }
  try {
    const snapshot = await loadDashboard(process.env.FRED_API_KEY);
    res.setHeader(
      "Cache-Control",
      snapshot.errors.length
        ? "no-store"
        : "public, max-age=0, s-maxage=3600, stale-while-revalidate=3600",
    );
    return res.status(200).json(snapshot);
  } catch {
    res.setHeader("Cache-Control", "no-store");
    return res
      .status(502)
      .json({ error: "Data refresh failed. Try again later." });
  }
}
