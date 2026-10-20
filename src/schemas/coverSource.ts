import { z } from "astro/zod";

const webURL = z.url({
  protocol: /^https?$/,
  error: "Image source links must use HTTP or HTTPS",
});

export const coverSourceSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("identified"),
    title: z.string().trim().min(1),
    artist: z.string().trim().min(1),
    url: webURL,
    artistUrl: webURL.optional(),
  }),
  z.object({
    status: z.literal("unresolved"),
  }),
]);

export type CoverSource = z.infer<typeof coverSourceSchema>;
