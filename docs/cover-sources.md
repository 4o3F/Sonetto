# 头图来源维护说明

## 范围与展示

本文说明文章 `cover` 字段所指定头图的来源维护方式。首页、文章列表和标签页的文章卡片，以及文章详情页，统一显示作者署名和作品链接。没有头图的页面不添加来源说明。正文插图、站点头像和社交分享图片不属于本次来源补录范围。

来源信息写在文章的 frontmatter 中，不在浏览器中调用反向搜图服务，也不加载第三方来源图片。站点仍使用仓库中的本地头图和现有的图片优化流程。

## 字段格式

已核实来源的插画填写作品名称、作者、作品原始发布页和作者主页：

```yaml
cover: "./cover.jpg"
coverAlt: "与图片内容相符的替代文字"
coverSource:
  status: identified
  title: "おやつの時間"
  artist: "SWAV"
  url: "https://www.pixiv.net/artworks/90671173"
  artistUrl: "https://www.pixiv.net/users/5130774"
```

`artistUrl` 可以省略。动画截图的 `title` 应写明作品与集数，游戏图片的 `title` 应写明游戏名称。`artist` 可以填写官方公布的版权署名，或适用的制作、发行机构署名，`url` 指向作品的官方页面；没有确认具体画师时，不填写推测的画师姓名。

无法可靠确认来源时，必须明确标记：

```yaml
coverSource:
  status: unresolved
```

页面将显示“头图来源待核实”，而不是推测的作者、作品名称或链接。`identified` 只表示已识别来源，不表示获得授权，也不保证原始发布页以后仍然可访问。

设置 `cover` 却缺少 `coverAlt` 或 `coverSource` 会使内容校验失败。来源链接和作者主页仅接受 HTTP 或 HTTPS，不能填写脚本链接或本地文件路径。字段约束定义在 `src/schemas/coverSource.ts` 和 `src/content.config.ts` 中。

## 核实与使用许可

1. 使用 SauceNAO 等反向搜图服务查找候选作品。必要时可以用 IQDB 补查，但转载站的结果只作为线索。
2. 对照图片本身确认是否为同一作品。相似度不是版权证明，也不能单凭最高相似度认定作者；裁剪后的图片还可能只有较低相似度。
3. 优先核对作者的原始发布页，确认作品名称、作者和账号。Pixiv 作品链接使用 `https://www.pixiv.net/artworks/<作品编号>`，作者主页使用 `https://www.pixiv.net/users/<用户编号>`。
4. 另行确认作品的使用许可。公开发布、可以下载、反向搜图命中或添加署名，均不等于允许在博客中复制、裁剪、展示或用于社交分享。
5. 作者禁止转载、许可不适用或无法确认使用权时，应先停用或替换图片，再决定是否发布。不能用“侵删”等说明代替授权。

本次补录没有取得或声称取得任何新增授权，也没有替换或删除现有图片。来源尚未核实和许可尚未确认是两个不同的问题，均需在发布前处理。

## 本次核实结果

2026 年 10 月 20 日，31 张文章头图均已记录来源，其中 27 张为 Pixiv 作品、2 张为 ArtStation 作品集中的图片、1 张为《Unnamed Memory》第 4 集截图、1 张为《Stellaris（群星）》游戏图片。每张图片的署名和链接保存在对应文章的 `coverSource` 中，目前没有标记为 `unresolved` 的头图。

查询以 SauceNAO 为主，使用 IQDB 补查，并对照命中的图片内容。Pixiv 作品通过作品接口进一步核对作品名称和作者账号。对于裁剪后的图片，没有只按相似度分数判断。例如 JMeter 文章头图和 SpectralGPT 文章头图虽然匹配分数较低，但已对照图片确认作品，并核对 Pixiv 信息。

ArtStation 的原始作品页本次返回 HTTP 403，因此其作者、项目名称和作品链接依据 SauceNAO 的索引记录及匹配图片确认，未声称验证了当前页面内容或使用许可。部分低相似度候选作品已经删除或无法访问，未据此填写作者。检索期间 SauceNAO 匿名查询曾返回 HTTP 429，已停止匿名请求，后续使用用户授权的登录会话完成查询；会话凭据不进入项目文件。

以下来源由用户提供，并完成对应信息核对：

| 文章目录 | 署名 | 来源 |
| --- | --- | --- |
| `adb-tls-protocol` | 小木蹬子 | [不想上班鸭](https://www.pixiv.net/artworks/96139474) |
| `ascend-model-migration` | Xenomorph | [2026国庆](https://www.pixiv.net/artworks/150324106) |
| `docker-network-isolation` | 室埴 ポコ | [ナタ装備](https://www.pixiv.net/artworks/103979119) |
| `jprofiler-investigate` | HOJI | [部屋を片付けるのが苦手](https://www.pixiv.net/artworks/80913701) |
| `msvc-llvm` | Paradox Interactive | [《Stellaris（群星）》官方游戏页](https://www.paradoxinteractive.com/games/stellaris/about) |
| `react-native-crack` | ttingdong | [千反田える](https://www.pixiv.net/artworks/76112680) |
| `selfhost-nat-rdp` | ttosom | [作品标题为「-」](https://www.pixiv.net/artworks/87327580) |

其中 6 张 Pixiv 作品通过作品接口核对了标题和作者账号，并通过 Pixiv 官方嵌入图片与本地头图进行比对。`selfhost-nat-rdp` 保留原作的标题「-」，没有另行编造作品名称。

《Stellaris（群星）》图片的游戏来源依据用户确认，链接指向可访问的官方游戏页，采用发行机构 Paradox Interactive 署名。本次未确认该图片的独立素材编号、具体画师或授权条款，因此没有将游戏来源标注写成具体画师署名或授权声明。

## 验证

修改来源信息或展示组件后运行：

```bash
node --experimental-strip-types --test tests/cover-source.test.mjs tests/mermaid-markdown.test.mjs
pnpm lint
pnpm exec prettier --check src/schemas/coverSource.ts src/components/CoverCredit.astro src/components/Card.astro src/components/PostCover.astro 'src/pages/posts/[...slug]/index.astro' src/content.config.ts tests/cover-source.test.mjs README.md docs/cover-sources.md --prose-wrap never
pnpm build
```

来源字段测试覆盖必填信息、待核实状态、链接协议限制、所有有头图文章的来源字段完整性，以及用户提供的 7 张头图的作品链接和署名对应关系。既有文章正文的格式与换行保持不变，不为补录头图来源而整篇格式化。

本次验证结果：

- 来源字段和既有 Mermaid 测试合计 10 项，全部通过。
- ESLint、上述新增代码和文档的 Prettier 检查、`git diff --check` 均通过。
- 针对本次提交内容执行 `pnpm build` 成功，Astro 检查为 0 错误、0 警告、0 提示，生成 64 个静态页面。
- 对构建产物逐页检查，31 篇有头图文章均有来源署名和作品链接，58 个页面共展示 132 处来源说明；每处链接与所属文章配置一致，不存在嵌套链接或“头图来源待核实”标记，来源说明不进入 Pagefind 正文索引。
- 构建仍提示部分 JavaScript 产物超过 500 kB，Pagefind 提示不支持中文词干处理，均未阻止构建。本次未调整这些与头图来源无关的行为。

这些检查验证的是数据完整性和页面输出，不是对图片使用权的法律确认。
