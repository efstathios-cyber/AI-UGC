# Sarah UGC AI Creator

Autonomous MVP pipeline for generating Sarah-style real-estate funding UGC Reels.

The current implementation:

- generates weekday-aware content briefs,
- creates Sarah-style script JSON with OpenAI or a deterministic local mock,
- enforces compliance checks before media generation,
- sends one spoken audio+video job to a Seed Dance adapter,
- downloads the generated Seed Dance MP4,
- exports an Instagram-ready manual handoff package without modifying video bytes.

## Setup

```bash
npm install
cp .env.example .env
```

Add `sarah.jpg` at the project root before using the live Seed Dance adapter.

## Commands

```bash
npm run build
npm test
npm run generate
npm run meta:exchange-token
npm run meta:discover
npm run instagram:publish-latest
npm run facebook:post-latest
```

`npm run generate` uses local mock providers unless API keys are configured.

## Live Provider Notes

- `OPENAI_API_KEY` enables live script generation.
- `SEED_DANCE_API_KEY` and `SEED_DANCE_BASE_URL` enable live Seed Dance job creation.
- Without live credentials, the mock Seed Dance adapter writes a placeholder MP4 file so the pipeline can be tested end to end.
- The pipeline does not transcode, mux, strip, or rewrite generated videos. The handoff `reel.mp4` is a byte-for-byte copy of the downloaded provider MP4.

The MVP intentionally uses manual Instagram handoff. Direct posting can be added by implementing the publisher interface once Meta account, app review, tokens, and permissions are ready.

## Instagram Publishing

Configure these values locally before publishing:

```bash
META_APP_ID=
META_APP_SECRET=
META_SHORT_LIVED_USER_TOKEN=
META_ACCESS_TOKEN=
META_IG_USER_ID=
META_GRAPH_VERSION=v24.0
INSTAGRAM_SHARE_TO_FEED=true
```

Use `npm run meta:exchange-token` to exchange a short-lived Facebook user token for a long-lived token. Use `npm run meta:discover` to list Pages and connected Instagram professional accounts. Use `npm run instagram:publish-latest` to publish the newest handoff as a Reel using its public Seed Dance `sourceVideoUrl`.

Instagram publishing requires a Business or Creator Instagram account connected to a Facebook Page, a token with the required Instagram publishing permissions, and a public video URL. Local MP4 files are not uploaded directly to Meta.

## Facebook Page Posting

Configure:

```bash
FACEBOOK_PAGE_ID=
FACEBOOK_PAGE_ACCESS_TOKEN=
FACEBOOK_VIDEO_TITLE=Sarah UGC Reel
FACEBOOK_PUBLISHED=true
```

Use `npm run facebook:post-latest` to post the newest handoff video to a Facebook Page. It will prefer the public Seed Dance `sourceVideoUrl` when present; otherwise it uploads the local `reel.mp4` bytes directly to Facebook without transcoding or modifying the file.
