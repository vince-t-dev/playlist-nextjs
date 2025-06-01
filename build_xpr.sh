#!/usr/bin/env bash
set -euo pipefail

# 0. locate script dir
parent_path="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$parent_path"

# 1. ensure element folder exists
mkdir -p "$parent_path/xpr/element"

# 2. copy home page from build output to xpr/web and element
if [ -f "$parent_path/out/index.html" ]; then
	cp "$parent_path/out/index.html" "$parent_path/xpr/web/index.html"
	cp "$parent_path/out/index.html" "$parent_path/xpr/element/index.hbs"
else
	echo "out/index.html not found. Did you run 'npm run build'?"
	exit 1
fi

# 3. collect section sub-pages (slug-based)
slugs=()
for dir in "$parent_path"/xpr/web/*; do
	if [ -d "$dir" ] && [ -f "$dir/index.html" ]; then
		slug="$(basename "$dir")"
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

# use default empty array if slugs are empty
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

# 8. copy _next output
rm -rf "$parent_path/xpr/web/_nextjs"
mkdir -p "$parent_path/xpr/web/_nextjs"
cp -R "$parent_path/out/_next" "$parent_path/xpr/web/_nextjs"

echo "✅ xpr/element/*.hbs and bundle.json updated"
echo "✅ _next static assets copied to xpr/web/_nextjs"