# WebP Converter

Windows desktop app (plus a command-line tool) that turns very large TIFF/JPEG
images, from hundreds of megabytes to gigabytes, into high-quality WebP files
that are suitable for the web.

It is built on [sharp](https://sharp.pixelplumbing.com/) / libvips, which
streams images strip by strip instead of decoding them whole, so a 1 GB scan
converts in a few hundred megabytes of RAM.

## Building the Windows app

Requirements on the build machine: Windows, [Node.js](https://nodejs.org) LTS
(18.17 or newer) and internet access (the build downloads Electron and the
installer tooling on first run).

Double-click **`build.bat`**. It installs the dependencies, packages the app and
leaves two files in `dist/`:

| File | What it is |
| --- | --- |
| `WebP-Converter-1.0.0-setup.exe` | Installer; adds a Start menu entry. |
| `WebP-Converter-1.0.0-portable.exe` | Single executable, no installation. |

Neither needs Node.js on the machine where it runs. The same thing from a
terminal is `npm install` followed by `npm run build`.

If the Electron download is blocked in your region, set a mirror before
building, for example:

```bat
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
build.bat
```

## Using the app

1. **ورودی / Input**: pick a folder, pick files, or drag files and folders onto
   the window. Folders are searched recursively for `.tif .tiff .jpg .jpeg`.
2. **خروجی / Output**: pick an output folder, or leave it empty and a `webp`
   folder is created inside the input folder (next to a file given directly),
   mirroring any subfolders. Tick *overwrite* to replace existing `.webp`
   files; otherwise they are skipped.
3. **کیفیت / Quality**: the slider defaults to 100, the highest lossy WebP
   quality. 85 to 90 gives much smaller files for ordinary web use. *Lossless*
   produces pixel-identical files that are several times larger; it is meant
   for graphics, not photos.
4. **بزرگ‌ترین ضلع / Longest edge**: the output is downscaled so its longest
   edge fits this value (default 3840 px, a 4K screen). Images are never
   enlarged. "Original size" keeps the source dimensions, capped at the WebP
   format limit of 16383 px.
5. Press **شروع تبدیل** (Start). Each file is listed as it finishes with its
   old and new dimensions and sizes; a summary follows, and *Open output
   folder* opens the result in Explorer. *Cancel* stops after the current file.

## What happens to each image

- The EXIF orientation is applied, so the pixels are upright without relying
  on browser support for the tag.
- The image is downscaled so its longest edge fits the chosen limit.
- CMYK, 16-bit and ICC-profiled sources become 8-bit sRGB, the only colour
  space browsers render predictably.
- Lossy output uses the chosen quality with the highest compression effort
  and high-quality chroma subsampling; lossless output is exact.
- EXIF/XMP/ICC metadata is dropped to keep files small.
- Layered Photoshop TIFFs convert like any other TIFF. Their layer data sits
  in one tag that is often larger than the image, and libvips normally stops
  libtiff at 50 MiB of tag memory; that cap is lifted here and the flattened
  composite is used.

## Command line

The same engine is available as a CLI for scripts and servers:

```sh
npm install
node src/cli.js photo.tif                                   # webp/photo.webp next to photo.tif
node src/cli.js scans/                                      # whole folder tree into scans/webp
node src/cli.js --out web scans/                            # whole folder tree into ./web
node src/cli.js --out web --max-size 2560 --quality 85 scans/
node src/cli.js --help                                      # all options
```

Options mirror the app: `--out` (default: a `webp` folder inside the input
folder), `--max-size` (default 3840; 0 = original size), `--quality` (default
100), `--effort` (0-6, default 6), `--lossless`, `--force`. Exit code `0` means every file succeeded or was skipped, `1` that at
least one failed, `2` a usage error.

## Development

```sh
npm install
npm start      # run the desktop app from source
npm test       # unit tests for the conversion engine
```

## راهنمای فارسی

این برنامه عکس‌های حجیم TIFF و JPEG (حتی چند گیگابایتی) را به WebP باکیفیت و
مناسب وب تبدیل می‌کند. تصویر به‌صورت نواری پردازش می‌شود و کامل در RAM بار
نمی‌شود.

### ساخت برنامه‌ی ویندوز

روی سیستم ویندوزی باید [Node.js](https://nodejs.org) نسخه‌ی LTS نصب باشد و
اینترنت وصل باشد (بار اول Electron دانلود می‌شود). بعد روی **`build.bat`** دوبار
کلیک کنید. در پایان دو فایل در پوشه‌ی `dist` ساخته می‌شود:

- `WebP-Converter-1.0.0-setup.exe`: نصب‌کننده، با میان‌بر در منوی Start.
- `WebP-Converter-1.0.0-portable.exe`: نسخه‌ی قابل‌حمل، بدون نصب.

هیچ‌کدام برای اجرا به Node.js نیاز ندارند؛ فقط برای ساختن لازم است.

اگر دانلود Electron مسدود بود، قبل از اجرای `build.bat` در همان پنجره‌ی cmd
این را بزنید:

```bat
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
```

### کار با برنامه

1. **ورودی**: پوشه یا فایل‌ها را انتخاب کنید یا روی پنجره بکشید. پوشه‌ها همراه
   زیرپوشه‌هایشان برای فایل‌های tif، tiff، jpg و jpeg جست‌وجو می‌شوند.
2. **خروجی**: پوشه‌ی خروجی را انتخاب کنید یا خالی بگذارید تا خودکار پوشه‌ای به
   نام `webp` داخل پوشه‌ی ورودی ساخته شود (با همان زیرپوشه‌ها). فایل‌های موجود
   رد می‌شوند مگر «بازنویسی» را تیک بزنید.
3. **کیفیت**: پیش‌فرض ۱۰۰ یعنی بالاترین کیفیت. برای فایل کوچک‌تر ۸۵ تا ۹۰ برای
   وب معمول است. گزینه‌ی «بی‌افت» فایل دقیقاً بدون افت می‌سازد ولی چند برابر
   بزرگ‌تر است و برای گرافیک مناسب است، نه عکس.
4. **بزرگ‌ترین ضلع**: پیش‌فرض ۳۸۴۰ پیکسل (اندازه‌ی ۴K). تصاویر هرگز بزرگ
   نمی‌شوند. «اندازه‌ی اصلی» ابعاد را نگه می‌دارد، تا سقف ۱۶۳۸۳ پیکسل که حد
   خودِ فرمت WebP است.
5. **شروع تبدیل** را بزنید. هر فایل بعد از تبدیل با ابعاد و حجم قبل و بعد در
   فهرست می‌آید و در پایان خلاصه نشان داده می‌شود. «باز کردن پوشه‌ی خروجی»
   نتیجه را در Explorer باز می‌کند و «لغو» بعد از فایل جاری متوقف می‌شود.
