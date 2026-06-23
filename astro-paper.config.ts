import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://403f.cafe/",
    title: "403F's Cafe",
    description: "May we sail the stars and go far beyond.",
    author: "403F",
    profile: "https://github.com/4o3F",
    ogImage: "avatar.jpg",
    lang: "zh-CN",
    timezone: "Asia/Shanghai",
    dir: "ltr",
  },
  posts: {
    perPage: 5,
    perIndex: 5,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: false,
    showArchives: true,
    showBackButton: true,
    editPost: {
      enabled: false,
    },
    search: "pagefind",
  },
  socials: [
    {
      name: "github",
      url: "https://github.com/4o3F",
      linkTitle: "403F on GitHub",
    },
  ],
  shareLinks: [
    { name: "x", url: "https://x.com/intent/post?url=" },
    { name: "telegram", url: "https://t.me/share/url?url=" },
    {
      name: "mail",
      url: "mailto:?subject=403F's%20Cafe&body=",
      linkTitle: "通过邮件分享文章",
    },
  ],
});
