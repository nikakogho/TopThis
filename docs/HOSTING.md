# Public MVP hosting (Koyeb)

The $0 public MVP is one Koyeb free Web Service running the Vite build and
Fastify/API/Socket.IO process on the same origin. Use the button below with a
Koyeb account:

[![Deploy to Koyeb](https://www.koyeb.com/static/images/deploy/button.svg)](https://app.koyeb.com/deploy?type=git&repository=github.com%2Fnikakogho%2FTopThis&branch=main&name=topthis&builder=buildpack&instance_type=free&region=fra&ports=8000%3Bhttp%3B%2F&env%5BNODE_ENV%5D=production&env%5BTOPTHIS_DATABASE_PATH%5D=%2Ftmp%2Ftopthis.sqlite&build_command=pnpm%20build&run_command=pnpm%20start)

The query names above follow Koyeb’s [Deploy to Koyeb button documentation](https://www.koyeb.com/docs/build-and-deploy/deploy-to-koyeb-button): `type`, `repository`, `branch`, `name`, `builder`, `instance_type`, `region`, `ports`, `env[...]`, `build_command`, and `run_command`.

## Click and verify

1. Click the button, sign in to Koyeb, and confirm the public GitHub repository and `main` branch.
2. Confirm one **Web** Service named `topthis`, free instance, Frankfurt (`fra`), HTTP port 8000, and the two environment variables.
3. Deploy. The build command is `pnpm build`; the run command is `pnpm start`.
4. Open the generated public URL and visit `/health`; it should return the server’s healthy response.
5. Keep exactly one running instance. Socket.IO games and SQLite state are process-local.

The free service may sleep and wake. The first request after sleep can be slow.
Local SQLite/profile/rating/leaderboard state is ephemeral on free Koyeb and can
reset after sleep, reschedule, or deploy. Active games cannot survive process
replacement.

## Cost trade-offs

- Koyeb Free: $0, suitable for this single-instance public MVP. [Free instance docs](https://www.koyeb.com/docs/reference/instances)
- Render Free: $0, roughly one-minute wake, 15-minute idle sleep, ephemeral disk. [Render pricing](https://render.com/pricing)
- Railway Hobby: $5 minimum. [Railway pricing](https://railway.com/pricing)
- Render durable: $7 plus disk. [Render persistent disks](https://render.com/docs/disks)
- Fly.io: approximately $2.17 before network for 256 MB compute ($2.02) plus a 1 GB volume ($0.15). [Fly pricing](https://fly.io/docs/about/pricing/)
