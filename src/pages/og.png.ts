import type { APIRoute } from "astro";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const GET: APIRoute = async () => {
  const avatar = await readFile(path.join(process.cwd(), "public/avatar.jpg"));
  const image = await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: "#fefbfb",
    },
  })
    .composite([
      {
        input: await sharp(avatar).resize(360, 360).png().toBuffer(),
        left: 420,
        top: 135,
      },
    ])
    .png()
    .toBuffer();

  return new Response(new Uint8Array(image), {
    headers: { "Content-Type": "image/png" },
  });
};
