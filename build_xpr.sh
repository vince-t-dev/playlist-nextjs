#!/usr/bin/env bash
set -euo pipefail

# 0. locate script directory
parent_path="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$parent_path"

# 1. ensure element folder exists
mkdir -p "$parent_path/xpr/element"

# 2. copy home page from build output (distDir is xpr/web) to element/index.hbs
if [ -f "$parent_path/xpr/web/index.html" ]; then
	cp "$parent_path/xpr/web/index.html" "$parent_path/xpr/element/index.hbs"
else
	echo "xpr/web/index.html not found. Did you run 'npm run build'?"
	exit 1
fi





# 2.5. patch _next/data/ paths with prefix for static export support
prefix="/__xpr__/pub_engine/playlist-nextjs/web"
echo "🔧 Rewriting _next/data paths with prefix: $prefix"

find "$parent_path/xpr/web" -type f \( -name "*.html" -o -name "*.js" -o -name "*.json" \) | while read -r file; do
	sed -i '' -e "s|\"/_next/data/|\"$prefix/_next/data/|g" "$file"
	sed -i '' -e "s|'/_next/data/|'$prefix/_next/data/|g" "$file"
done



# 3. collect section sub-pages (slug-based)
slugs=()
for dir in "$parent_path"/xpr/web/*; do
	if [ -d "$dir" ] && [ -f "$dir/index.html" ]; then
		slug="$(basename "$dir")"
		# Skip system files/folders (e.g., .DS_Store)
		[[ "$slug" == .* ]] && continue
		cp "$dir/index.html" "$parent_path/xpr/element/$slug.hbs"
		slugs+=("$slug")
	fi
done

# 4. collect playlist components (*.tsx) as skins
skins=()
for file in "$parent_path"/src/components/playlists/*.tsx; do
	[ -e "$file" ] || continue
	filename=$(basename "$file" .tsx)
	cp "$file" "$parent_path/xpr/element/$filename.hbs"
	skins+=("$filename")
done

# 5. build templates JSON
home_template='[{ "name": "Home Template", "element": "index", "options": {} }]'

if [ ${#slugs[@]} -gt 0 ]; then
	section_templates="$(printf '%s\n' "${slugs[@]}" | jq -R -s -c '
		split("\n")[:-1] | map({
			name: ((.[0:1] | ascii_upcase) + .[1:] + " Template"),
			element: .,
			options: {}
		})
	')"
else
	section_templates='[]'
fi

templates_json="$(jq -s add <(echo "$home_template") <(echo "$section_templates"))"

# 6. build skins JSON
if [ ${#skins[@]} -gt 0 ]; then
	skins_json="$(printf '%s\n' "${skins[@]}" | jq -R -s -c '
		split("\n")[:-1] | map({
			name: .,
			element: .,
			options: {}
		})
	')"
else
	skins_json='[]'
fi

# 7. inject into bundle.json
bundle_json="$parent_path/xpr/bundle.json"
tmp_json="${bundle_json}.tmp"

jq --argjson templates "$templates_json" \
   --argjson skins "$skins_json" '
	.templates = $templates
	| .skins = $skins
' "$bundle_json" > "$tmp_json"

mv "$tmp_json" "$bundle_json"

echo "✅ xpr/element/*.hbs and bundle.json 'templates' + 'skins' updated"