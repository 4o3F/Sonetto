import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";
import matter from "gray-matter";
import { coverSourceSchema } from "../src/schemas/coverSource.ts";

const source = {
  status: "identified",
  title: "作品名称",
  artist: "作者",
  url: "https://www.pixiv.net/artworks/90671173",
  artistUrl: "https://www.pixiv.net/users/5130774",
};

test("identified covers require a title, artist and original source URL", () => {
  assert.equal(coverSourceSchema.safeParse(source).success, true);
  for (const field of ["title", "artist", "url"]) {
    assert.equal(
      coverSourceSchema.safeParse({ ...source, [field]: undefined }).success,
      false,
      field
    );
  }
  assert.equal(
    coverSourceSchema.safeParse({ ...source, artist: "  " }).success,
    false
  );
});

test("unknown sources are explicit and do not imply permission", () => {
  assert.deepEqual(coverSourceSchema.parse({ status: "unresolved" }), {
    status: "unresolved",
  });
  assert.equal(
    coverSourceSchema.safeParse({ status: "authorized" }).success,
    false
  );
});

test("source and artist links only accept HTTP or HTTPS", () => {
  for (const field of ["url", "artistUrl"]) {
    for (const value of [
      "javascript:alert(1)",
      "data:text/html,hello",
      "file:///tmp/image.jpg",
      "/artworks/90671173",
      "not a URL",
    ]) {
      assert.equal(
        coverSourceSchema.safeParse({ ...source, [field]: value }).success,
        false,
        `${field}: ${value}`
      );
    }
  }
});

test("every post with a cover declares its source or marks it unresolved", async () => {
  const root = new URL("../src/content/posts/", import.meta.url);
  const entries = await readdir(root, { recursive: true });
  let covers = 0;
  for (const entry of entries) {
    if (!/(^|\/)index\.mdx?$/.test(entry)) continue;
    const { data } = matter(await readFile(new URL(entry, root), "utf8"));
    if (!data.cover) continue;
    covers++;
    const result = coverSourceSchema.safeParse(data.coverSource);
    assert.equal(result.success, true, `${entry}: ${result.error?.message}`);
  }
  assert.ok(covers > 0, "cover fixtures must not be empty");
});

test("user-provided cover sources retain their original work and creator links", async () => {
  const root = new URL("../src/content/posts/", import.meta.url);
  const works = [
    ["ascend-model-migration", "150324106", "33950104", "Xenomorph"],
    ["adb-tls-protocol", "96139474", "59046424", "小木蹬子"],
    ["docker-network-isolation", "103979119", "76266", "室埴 ポコ"],
    ["jprofiler-investigate", "80913701", "19133926", "HOJI"],
    ["react-native-crack", "76112680", "41751245", "ttingdong"],
    ["selfhost-nat-rdp", "87327580", "6203904", "ttosom"],
  ];

  for (const [slug, workId, userId, artist] of works) {
    const { data } = matter(
      await readFile(new URL(`${slug}/index.md`, root), "utf8")
    );
    const credit = coverSourceSchema.parse(data.coverSource);
    assert.equal(credit.status, "identified", slug);
    assert.equal(credit.url, `https://www.pixiv.net/artworks/${workId}`, slug);
    assert.equal(
      credit.artistUrl,
      `https://www.pixiv.net/users/${userId}`,
      slug
    );
    assert.equal(credit.artist, artist, slug);
  }

  const { data } = matter(
    await readFile(new URL("msvc-llvm/index.md", root), "utf8")
  );
  assert.deepEqual(coverSourceSchema.parse(data.coverSource), {
    status: "identified",
    title: "《Stellaris（群星）》游戏图片",
    artist: "Paradox Interactive",
    url: "https://www.paradoxinteractive.com/games/stellaris/about",
  });
});
