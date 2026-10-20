import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";
import config from "@/config";
import { coverSourceSchema } from "@/schemas/coverSource";

export const BLOG_PATH = "src/content/posts";

const posts = defineCollection({
  loader: glob({ pattern: "**/index.{md,mdx}", base: `./${BLOG_PATH}` }),
  schema: ({ image }) =>
    z
      .object({
        author: z.string().default(config.site.author),
        pubDatetime: z.coerce.date(),
        modDatetime: z.coerce.date().optional().nullable(),
        title: z.string().min(1),
        featured: z.boolean().optional(),
        draft: z.boolean().optional(),
        tags: z.array(z.string().min(1)).default(["others"]),
        cover: image().optional(),
        coverAlt: z.string().trim().min(1).optional(),
        coverSource: coverSourceSchema.optional(),
        description: z.string().min(1),
        canonicalURL: z.string().optional(),
        hideEditPost: z.boolean().optional(),
        timezone: z.string().default(config.site.timezone),
      })
      .superRefine((data, ctx) => {
        if (!data.cover) return;

        if (!data.coverAlt) {
          ctx.addIssue({
            code: "custom",
            path: ["coverAlt"],
            message: "coverAlt is required when cover is set",
          });
        }

        if (!data.coverSource) {
          ctx.addIssue({
            code: "custom",
            path: ["coverSource"],
            message: "coverSource is required when cover is set",
          });
        }
      }),
});

const pages = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    ogImage: z.string().optional(),
    canonicalURL: z.string().optional(),
  }),
});

export const collections = { posts, pages };
