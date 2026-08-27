# Video Background Assets

This directory contains video files for hero sections and backgrounds on marketing pages.

## Required Videos

Place the following MP4 video files in this directory:

- `hero-main.mp4` - Homepage hero background
- `hero-field-app.mp4` - Field app page hero
- `hero-product.mp4` - Product overview page hero
- `hero-construction.mp4` - Construction solutions hero
- `hero-waste.mp4` - Waste and haulage solutions hero
- `hero-contact.mp4` - Contact page hero
- `hero-resources.mp4` - Resources page hero

## Video Specifications

- Format: MP4 (H.264 codec)
- Resolution: 1920×1080 minimum (supports responsive scaling)
- Duration: 10-15 seconds (looped)
- File size: 2-5 MB recommended for performance
- Encoding: Optimized for web (use ffmpeg with libx264)

## Fallback Behavior

If video files are missing, the `VideoBackground` component automatically displays a dark gradient fallback:
- Homepage: `linear-gradient(135deg, #0A1628 0%, #1C1A2E 100%)`
- Marketing pages: `linear-gradient(135deg, #1e293b 0%, #0f172a 100%)`

## Example FFmpeg Encoding

```bash
ffmpeg -i input.mov -c:v libx264 -preset slow -crf 22 -c:a aac -b:a 128k output.mp4
```

This produces a high-quality, web-optimized MP4 suitable for hero backgrounds.

## Adding Videos Programmatically

Videos can also be added via CI/CD pipelines or during the build process. Update the deployment script to download or generate placeholder videos if needed.
