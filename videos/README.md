# MetricOra films

Remotion films built from the product's own tokens and demo data. Read `BRAND.md` (the kit and the rules) and `launch-prompt.md` (the launch film's story).

```bash
cd videos
npm install
npm run setup        # copies Geist from the app, composes the score and sound effects
npm run studio       # preview
npm run stills -- out/review/v1 600 1500 --composition Launch
npm run render       # 240 fps master, motion blur, deliverables in out/metricora-launch/
uv run --with numpy --with imageio-ffmpeg python3 scripts/verify.py out/metricora-launch --duration 56 --bg 11,16,14
```

The score is original, composed in code (`scripts/compose.py`), so it carries no licence terms. `out/`, `public/audio/` and `public/fonts/` are generated and not committed.
