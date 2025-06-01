#!/usr/bin/env bash
set -euo pipefail

# 0. Locate script dir
parent_path="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$parent_path"

# 1. Ensure element folder exists
mkdir -p "$parent_path/xpr/element"

# 2. Copy home page as index.hbs
cp "$parent_path/xpr/web/index.html" "$parent_path/xpr/element/index.hbs"

# 3. Collect section sub-pages (slug-based)
slugs=()
for dir in "$parent_path"/xpr/web/*; do
  if [ -d "$dir" ] && [ -f "$dir/index.html" ]; then
    slug="$(basename "$dir")"
    cp "$dir/index.html" "$parent_path/xpr/element/$slug.hbs"
    slugs+=("$slug")
  fi
done

# 4. Collect playlist components (*.tsx) as skins
skins=()
for file in "$parent_path"/src/components/playlists/*.tsx; do
  [ -e "$file" ] || continue
  filename=$(basename "$file" .tsx)
  cp "$file" "$parent_path/xpr/element/$filename.hbs"
  skins+=("$filename")
done

# 5. Build templates JSON
home_template='[{ "name": "Home Template", "element": "index", "options": {} }]'
section_templates="$(printf '%s\n' "${slugs[@]}" | jq -R -s -c '
  split("\n")[:-1] | map({
    name: ((.[0:1] | ascii_upcase) + .[1:] + " Template"),
    element: .,
    options: {}
  })
')"

templates_json="$(jq -s add <(echo "$home_template") <(echo "$section_templates"))"

# 6. Build skins JSON
skins_json="$(printf '%s\n' "${skins[@]}" | jq -R -s -c '
  split("\n")[:-1] | map({
    name: .,
    element: .,
    options: {}
  })
')"

# 7. Inject into bundle.json
bundle_json="$parent_path/xpr/bundle.json"
tmp_json="${bundle_json}.tmp"

jq --argjson templates "$templates_json" \
   --argjson skins "$skins_json" '
  .templates = $templates
  | .skins = $skins
' "$bundle_json" > "$tmp_json"

mv "$tmp_json" "$bundle_json"

echo "✅ xpr/element/*.hbs and bundle.json 'templates' and 'skins' updated"
