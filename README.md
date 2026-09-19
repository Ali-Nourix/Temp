# webp-convert

Command-line converter that turns very large TIFF/JPEG images (hundreds of
megabytes to gigabytes) into high-quality WebP files that are suitable for the
web.

It is built on [sharp](https://sharp.pixelplumbing.com/) / libvips, which
streams images strip by strip instead of decoding them whole, so a 1 GB scan
converts in a few hundred megabytes of RAM.

## What it does to each image

- Applies the EXIF orientation, so the pixels are upright without relying on
  browser support for the tag.
- Downscales so the longest edge fits `--max-size` (default 3840 px, i.e. a
  4K screen). Images are never enlarged. The WebP format cannot exceed
  16383 px on either side, so `--max-size 0` ("keep the original size") is
  still capped there.
- Converts CMYK, 16-bit and ICC-profiled sources to 8-bit sRGB, the only
  colour space browsers render predictably.
- Encodes lossy WebP at quality 90 with the highest compression effort and
  high-quality chroma subsampling, or lossless WebP with `--lossless`.
- Strips EXIF/XMP/ICC metadata to keep files small.

## Requirements

Node.js 18.17 or newer. No system libraries are needed; sharp ships its own
prebuilt libvips.

## Install

```sh
npm install
```

## Usage

```sh
# Convert one file; photo.webp is written next to photo.tif
node src/cli.js photo.tif

# Convert every .tif/.tiff/.jpg/.jpeg under a folder (recursively),
# mirroring the folder structure into ./web
node src/cli.js --out web scans/

# Smaller files for a gallery: 2560 px long edge, quality 85
node src/cli.js --out web --max-size 2560 --quality 85 scans/

# Keep the full resolution (capped at 16383 px) and overwrite existing outputs
node src/cli.js --max-size 0 --force poster.tif
```

`npm run convert -- <args>` and, after `npm link`, plain `webp-convert <args>`
do the same thing.

### Options

| Option | Default | Meaning |
| --- | --- | --- |
| `-o, --out <dir>` | next to source | Output folder; input folder structure is mirrored beneath it. |
| `-s, --max-size <px>` | `3840` | Longest edge of the output. `0` keeps the original size (capped at 16383). |
| `-q, --quality <n>` | `90` | WebP quality, 1-100. |
| `-e, --effort <n>` | `6` | Compression effort, 0-6. 6 is slowest and produces the smallest files. |
| `--lossless` | off | Lossless WebP. Files get much larger; for graphics and line art, not photos. |
| `-f, --force` | off | Overwrite existing `.webp` files instead of skipping them. |

Folders are filtered to `.tif .tiff .jpg .jpeg` (any case). A file named
explicitly on the command line is converted whatever its extension. When two
sources in one folder would produce the same name (`photo.tif` and
`photo.jpg`), the outputs keep the source extension: `photo.tif.webp` and
`photo.jpg.webp`.

Each conversion prints one line with the source and output dimensions, file
sizes and the saving; a summary follows at the end. The exit code is `0` when
everything succeeded or was skipped, `1` when at least one file failed and
`2` for a usage error.

## Development

```sh
npm test
```

## راهنمای فارسی

این ابزار عکس‌های حجیم TIFF و JPEG (حتی چند گیگابایتی) را به WebP باکیفیت و
مناسب وب تبدیل می‌کند. تصویر به‌صورت نواری پردازش می‌شود و کامل در RAM بار
نمی‌شود.

روی هر عکس این کارها انجام می‌شود: چرخش EXIF اعمال می‌شود، ضلع بزرگ‌تر به
`--max-size` (پیش‌فرض ۳۸۴۰ پیکسل) کوچک می‌شود و هیچ‌وقت بزرگ نمی‌شود، رنگ به
sRGB هشت‌بیتی تبدیل می‌شود، با کیفیت ۹۰ و بیشترین فشرده‌سازی به WebP رمزگذاری
می‌شود و متادیتا حذف می‌شود. سقف فرمت WebP در هر بُعد ۱۶۳۸۳ پیکسل است، پس حتی
با `--max-size 0` بیشتر از آن نمی‌شود.

```sh
npm install

# یک فایل؛ خروجی کنار خودش با پسوند .webp ساخته می‌شود
node src/cli.js photo.tif

# همه‌ی عکس‌های یک پوشه (و زیرپوشه‌ها) با همان ساختار در پوشه‌ی web
node src/cli.js --out web scans/

# فایل کوچک‌تر برای گالری
node src/cli.js --out web --max-size 2560 --quality 85 scans/
```

فایل‌هایی که خروجی‌شان از قبل وجود دارد رد می‌شوند؛ برای بازنویسی از
`--force` استفاده کنید.
