#!/usr/bin/env bash
#
# Makes web sized copies of the photos used by the gallery.
#
#   1. put the full size photo in  images/
#   2. add a <figure> block in index.html pointing at
#        images/opt/gallery/<name>.jpg   (and .webp in the <source>)
#   3. run                          bash tools/gallery.sh
#
# The script reads index.html to find which photos the gallery actually uses,
# so it never builds copies of anything else. Photos already built are skipped
# unless the original is newer. Pass --force to rebuild everything.
#
# Needs ffmpeg on PATH.

set -euo pipefail

WIDTH=700        # displayed at roughly 260px, so this covers retina screens
QUALITY=78       # webp quality
JPEG_Q=5         # ffmpeg -q:v, lower number is better quality

cd "$(dirname "$0")/.."
mkdir -p images/opt/gallery

force=0
[ "${1:-}" = "--force" ] && force=1

# names referenced by the gallery, e.g. images/opt/gallery/lookout.jpg -> lookout
names=$(grep -oE 'images/opt/gallery/[A-Za-z0-9._-]+\.(jpg|webp)' index.html \
        | sed -E 's#.*/##; s#\.(jpg|webp)$##' | sort -u)

if [ -z "$names" ]; then
  echo "No gallery photos referenced in index.html yet."
  exit 0
fi

built=0
missing=0

for name in $names; do
  # find the original, whatever its extension
  src=""
  for ext in jpg jpeg JPG JPEG png PNG; do
    [ -f "images/$name.$ext" ] && { src="images/$name.$ext"; break; }
  done

  if [ -z "$src" ]; then
    echo "  MISSING  images/$name.*  (referenced by index.html)"
    missing=$((missing + 1))
    continue
  fi

  out_jpg="images/opt/gallery/$name.jpg"
  out_webp="images/opt/gallery/$name.webp"

  if [ $force -eq 0 ] && [ -f "$out_jpg" ] && [ "$out_jpg" -nt "$src" ]; then
    continue
  fi

  ffmpeg -y -v error -i "$src" \
    -vf "scale=$WIDTH:-2:flags=lanczos" -q:v $JPEG_Q "$out_jpg"
  ffmpeg -y -v error -i "$src" \
    -vf "scale=$WIDTH:-2:flags=lanczos" \
    -c:v libwebp -quality $QUALITY -compression_level 6 "$out_webp"

  # keep the webp only when it actually beats the jpeg
  if [ "$(stat -c%s "$out_webp")" -ge "$(stat -c%s "$out_jpg")" ]; then
    rm -f "$out_webp"
    echo "  $name  (jpeg only, webp came out larger)"
  else
    echo "  $name"
  fi
  built=$((built + 1))
done

echo
if [ $built -eq 0 ] && [ $missing -eq 0 ]; then
  echo "Everything is up to date. Use --force to rebuild."
else
  if [ $built -gt 0 ]; then
    echo "Built $built photo(s) into images/opt/gallery/."
  fi
  if [ $missing -gt 0 ]; then
    echo "$missing photo(s) referenced but not found in images/."
  fi
fi

# a missing original is worth a non-zero exit; nothing else is
[ $missing -eq 0 ] || exit 1
exit 0
