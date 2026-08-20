const token = process.env.REPLICATE_API_TOKEN;
if (!token) throw new Error("REPLICATE_API_TOKEN not set");

const prompt = `A charming 3D-rendered octocat (GitHub's half-octopus, half-cat mascot: black cat head and body with grey octopus tentacle legs, round eyes) floating happily on top of a fluffy, glossy cloud rendered in Cloudflare's signature bright orange color. The octocat is mid-motion, joyfully throwing a small white paper airplane out to the side, arm extended in a throwing pose, as if sending an email. The scene has a clean, modern, playful tech-illustration style with soft studio lighting, gentle shadows, and a smooth gradient sky background transitioning from light blue to white. The orange cloud has a soft, puffy, cumulus shape with subtle highlights. Wide banner composition with the octocat and cloud centered-left, leaving open sky space to the right for the paper airplane's flight path. High detail, vibrant colors, professional product-illustration quality, suitable for a website social preview image.`;

import { readFileSync } from "fs";
// upload.wikimedia.org blocks hotlinking from Replicate's fetcher (403), so
// this reference image is inlined as a base64 data URI instead of a URL.
const cloudflareLogoDataUri = `data:image/png;base64,${readFileSync(
  new URL("../refs/cloudflare-logo.png", import.meta.url),
).toString("base64")}`;

const res = await fetch("https://api.replicate.com/v1/predictions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Prefer: "wait",
  },
  body: JSON.stringify({
    version: "google/nano-banana-2",
    input: {
      prompt,
      image_input: [
        "https://octodex.github.com/images/original.png",
        cloudflareLogoDataUri,
        "https://octodex.github.com/images/red-polo.png",
        "https://octodex.github.com/images/femalecodertocat.png",
        "https://octodex.github.com/images/octobiwan.jpg",
      ],
      aspect_ratio: "16:9",
      resolution: "2K",
      output_format: "jpg",
    },
  }),
});

const data = await res.json();
console.log(JSON.stringify(data, null, 2));
