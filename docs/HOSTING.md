# Public MVP hosting (Render Free)

The recommended $0 onboarding path is one Render Free Web Service created from
the repository Blueprint. Render supports WebSockets, and the Blueprint keeps
the Vite build plus Fastify/API/Socket.IO process on one same-origin instance.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fnikakogho%2FTopThis)

## Click and verify

1. Click **Deploy to Render**, sign in, and authorize GitHub for the public
   `nikakogho/TopThis` repository.
2. Approve the prefilled Blueprint from `render.yaml`. It creates one Free Web
   Service, uses `pnpm build` to build, and runs
   `NODE_ENV=production pnpm start` on the Render `PORT`. The Blueprint sets
   `TOPTHIS_DATABASE_PATH=/tmp/topthis.sqlite`; automatic deploys are disabled,
   so updates are deployed manually from Render after reviewing a new commit.
3. Choose the Free plan and click **Apply**. No app secret or payment method is
   required for this MVP.
4. Open the generated `https://<service>.onrender.com` URL and verify
   `https://<service>.onrender.com/health` returns the healthy server response.
5. Keep exactly one instance. Socket.IO games and SQLite state are process-local.

Fallback: in Render, choose **New → Blueprint**, enter
`https://github.com/nikakogho/TopThis`, select `main`, review `render.yaml`, and
apply the Free service manually. Do not add a second instance.

Render Free spins down after 15 minutes of inactivity and typically takes about
one minute to wake. It includes 750 service hours per month. The filesystem is
ephemeral: local SQLite/profile/rating/leaderboard state can reset after
spin-down, reschedule, or deploy, and active games cannot survive process
replacement. For persistence, use a paid durable service and external/durable
database after the MVP; see [Render pricing](https://render.com/pricing) and
[persistent disks](https://render.com/docs/disks).

Koyeb is not the recommended onboarding path: Koyeb’s February 17, 2026
announcement says new users must use Pro or higher plans. See the [Koyeb
announcement](https://www.koyeb.com/blog/koyeb-is-joining-mistral-ai-to-build-the-future-of-ai-infrastructure).

## Cost comparison

- Render Free: $0, WebSockets, 15-minute idle spin-down, about one-minute wake,
  750 hours, ephemeral filesystem.
- Railway Hobby: $5 minimum. [Railway pricing](https://railway.com/pricing)
- Render durable: $7 plus disk. [Render disks](https://render.com/docs/disks)
- Fly.io: about $2.17 before network for 256 MB compute plus a 1 GB volume.
  [Fly pricing](https://fly.io/docs/about/pricing/)
