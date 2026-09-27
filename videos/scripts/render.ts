import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Final render: a 240 fps master (4 subframes per 60 fps frame), blended with
 * ffmpeg tmix into 60 fps motion blur, then the deliverables.
 *
 *   bun scripts/render.ts <CompositionId> <file-name> --duration 52.8 --poster 48.4
 *
 * The composition must take `fps` as a prop (calculateMetadata sets fps and
 * durationInFrames from it). ffmpeg comes from imageio-ffmpeg through uv:
 * Remotion's own build has no tmix, select or tile filters.
 */
const args = process.argv.slice(2);
const flag = (name: string) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const [composition, name] = args;
const duration = Number(flag("--duration"));
const posterSeconds = Number(flag("--poster") ?? duration / 2);
if (!composition || !name || !duration) throw new Error("Usage: bun scripts/render.ts <CompositionId> <file-name> --duration <s> [--poster <s>]");

const root = resolve(import.meta.dirname, "..");
// The machine's own headless shell (Playwright's), so Remotion never downloads one.
const BROWSER = process.env.REMOTION_BROWSER ?? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const out = join(root, "out", name);
mkdirSync(out, { recursive: true });
const run = (command: string, list: string[]) => execFileSync(command, list, { cwd: root, stdio: "inherit" });
const ffmpeg = execFileSync("uv", ["run", "--quiet", "--with", "imageio-ffmpeg", "python3", "-c", "import imageio_ffmpeg as i; print(i.get_ffmpeg_exe())"], { encoding: "utf8" }).trim();

const master = join(out, "master-240.mp4");
const audio = join(out, "audio.wav");
const blurred = join(out, "blurred-60.mov");
const frames = Math.round(duration * 60);

// 1. The 240 fps master: lossless-ish PNG frames, 4:4:4 so fine textures keep their edges. No audio.
run("npx", ["remotion", "render", "src/index.ts", composition, master, "--props", JSON.stringify({ fps: 240 }), "--codec", "h264", "--crf", "8", "--pixel-format", "yuv444p", "--image-format", "png", "--muted", "--concurrency", "4", "--log", "error", "--browser-executable", BROWSER]);

// 2. The mix, once, at 60 fps (audio does not depend on fps).
run("npx", ["remotion", "render", "src/index.ts", composition, audio, "--codec", "wav", "--log", "error", "--browser-executable", BROWSER]);

// 3. Motion blur: average each group of 4 subframes, keep one per group -> 60 fps.
//    The master is untagged LIMITED range with the BT.601 matrix. Say so: reading it as
//    full range lifts every black (#0a0a0a comes out #171717). Out: BT.709 limited range.
run(ffmpeg, [
  "-v", "error", "-y", "-i", master,
  "-vf", "tmix=frames=4:weights='1 1 1 1',select='not(mod(n+1\\,4))',setpts=N/(60*TB),scale=in_range=tv:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv444p10le",
  "-r", "60", "-c:v", "prores_ks", "-profile:v", "4444", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv",
  blurred,
]);

// tune film + aq-mode 3 + no deadzones: x264 otherwise zeroes the faint residue of
// blurred words on the flat dark stage, leaving streaks a few levels off the ground.
const x264 = ["-c:v", "libx264", "-preset", "slow", "-tune", "film", "-pix_fmt", "yuv420p", "-x264-params", "colorprim=bt709:transfer=bt709:colormatrix=bt709:aq-mode=3:deadzone-inter=0:deadzone-intra=0", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv", "-movflags", "+faststart"];
const h264 = [...x264, "-crf", "18"];
// 10-bit to 8-bit without the scaler's dither, which VP9 turns into block noise.
const to8 = (size: string) => `scale=${size}:flags=lanczos+accurate_rnd:sws_dither=none,format=yuv420p`;

// 4. A muted loop for the page, one with the music, a WebM, the poster.
run(ffmpeg, ["-v", "error", "-y", "-i", blurred, ...h264, "-an", join(out, `${name}-1080p60.mp4`)]);
run(ffmpeg, ["-v", "error", "-y", "-i", blurred, "-i", audio, ...h264, "-c:a", "aac", "-b:a", "256k", "-shortest", join(out, `${name}-1080p60-audio.mp4`)]);
run(ffmpeg, ["-v", "error", "-y", "-i", blurred, "-vf", to8("1920:1080"), "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-row-mt", "1", "-an", join(out, `${name}-1080p60.webm`)]);
run(ffmpeg, ["-v", "error", "-y", "-i", blurred, "-i", audio, "-vf", to8("1920:1080"), "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "32", "-row-mt", "1", "-c:a", "libopus", "-b:a", "160k", "-shortest", join(out, `${name}-1080p60-audio.webm`)]);
// The site's hero: 720p at 30 fps, muted, WebM with an MP4 fallback.
run(ffmpeg, ["-v", "error", "-y", "-i", blurred, "-vf", `fps=30,${to8("1280:720")}`, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-row-mt", "1", "-an", join(out, `${name}-720p30.webm`)]);
run(ffmpeg, ["-v", "error", "-y", "-i", blurred, "-vf", "fps=30,scale=1280:720:flags=lanczos", ...x264, "-crf", "20", "-an", join(out, `${name}-720p30.mp4`)]);
run(ffmpeg, ["-v", "error", "-y", "-ss", String(posterSeconds), "-i", blurred, "-frames:v", "1", "-q:v", "2", join(out, "poster.jpg")]);

// 5. Loop seam: the last 8 and first 8 frames, played twice back to back, in one sheet.
run(ffmpeg, ["-v", "error", "-y", "-stream_loop", "1", "-i", join(out, `${name}-1080p60.mp4`), "-vf", `select='between(n\\,${frames - 8}\\,${frames + 7})',scale=320:180,tile=8x2`, "-frames:v", "1", "-vsync", "vfr", join(out, "loop-seam.png")]);

rmSync(master);
rmSync(blurred);
for (const file of [`${name}-1080p60.mp4`, `${name}-1080p60-audio.mp4`, `${name}-1080p60.webm`, `${name}-1080p60-audio.webm`, `${name}-720p30.webm`, `${name}-720p30.mp4`, "poster.jpg"]) {
  console.log(`${file}: ${(statSync(join(out, file)).size / 1e6).toFixed(1)} MB`);
}
