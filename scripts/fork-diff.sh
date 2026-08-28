#!/usr/bin/env bash
#
# Report how far each forked skill has drifted from the upstream release its `source:` frontmatter
# pins, file by file.
#
# This reports and never asserts: it defines no expected state, and it exits zero whatever it finds,
# so nothing in the repository can gate on it. The only non-zero exits are a bad invocation and a
# missing dependency, both of which are environment errors rather than findings.

set -euo pipefail

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cache_root="$repo/.scratch/sync"

usage() {
  cat <<'EOF'
Usage: scripts/fork-diff.sh [--tag <tag>] [--refresh] [<skill>...]

  <skill>     A fork to diff, e.g. `research`, `/research` or `skills/research`.
              With none given, every fork in skills/ is diffed.
  --tag       Diff against this upstream tag instead of the one `source:` pins — the comparison
              that shows which divergences upstream has already converged on. Pass it alongside an
              explicit skill selection, since one tag cannot be right for both upstreams.
              Both `--tag <tag>` and `--tag=<tag>` are accepted.
  --refresh   Re-fetch the upstream files even where the cache already holds them.

Run through mise, the flags need a separator: `mise run dev:fork-diff -- --refresh`.
Upstream files are cached under .scratch/sync/<upstream>/<tag>/, which is gitignored.
EOF
}

tag_override=""
refresh=0
skills=()

while [ $# -gt 0 ]; do
  case "$1" in
    --tag)
      # A trailing --tag would make `shift 2` fail and set -e exit 1 silently; a following flag
      # would be swallowed as the tag, and every fork would then skip on an unreadable tree.
      case "${2:-}" in
        ""|-*) echo "--tag needs a tag." >&2; usage >&2; exit 2 ;;
      esac
      tag_override="$2"
      shift 2
      ;;

    --tag=*)
      tag_override="${1#--tag=}"
      # An unset variable in --tag=$VAR would otherwise report the pinned tag as the override.
      [ -n "$tag_override" ] || { echo "--tag needs a tag." >&2; usage >&2; exit 2; }
      shift
      ;;

    --refresh) refresh=1; shift ;;
    -h|--help)  usage; exit 0 ;;
    -*)         echo "Unknown flag: $1" >&2; usage >&2; exit 2 ;;

    *)
      name="${1#/}"
      name="${name#skills/}"
      skills+=("${name%/}")
      shift
      ;;
  esac
done

# --- preflight ----------------------------------------------------------------------------------

# Say what is missing before any work starts, so a run fails at the top or not at all.
# Only the three that can realistically be absent: everything else this script calls is POSIX
# baseline, present wherever the bash it already runs under is.
missing=()

for tool in gh diff git; do
  command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
done

if [ ${#missing[@]} -gt 0 ]; then
  echo "Missing required command(s): ${missing[*]}" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "gh is not authenticated — run 'gh auth login', then re-run this script." >&2
  exit 1
fi

# --- which forks ----------------------------------------------------------------------------------

if [ ${#skills[@]} -eq 0 ]; then
  for f in "$repo"/skills/*/SKILL.md; do
    # A fork is a skill whose frontmatter records an upstream; the rest are this repo's own.
    if grep -q '^source:' "$f"; then
      d="${f%/SKILL.md}"
      skills+=("${d##*/}")
    fi
  done
fi

# --- helpers ----------------------------------------------------------------------------------

# A bare version is not a tag: each upstream prefixes it differently, and a guessed tag 404s.
tag_for() {
  case "$1" in
    mattpocock/skills) echo "v$2" ;;
    */compound-engineering-plugin) echo "compound-engineering-v$2" ;;
    *) return 1 ;;
  esac
}

# One writer for the tree listing and the file bodies alike. The write is atomic, so an interrupted
# fetch leaves a .tmp behind rather than a short file the next run would trust.
# </dev/null: gh reads stdin, and callers run inside loops reading the tree listing from it.
fetch_to() {
  local dest="$1"; shift
  local tmp="$dest.tmp.$$"
  mkdir -p "${dest%/*}"
  if ! gh api "$@" > "$tmp" 2>/dev/null </dev/null; then
    rm -f "$tmp"
    return 1
  fi
  mv -f "$tmp" "$dest"
}

# One reason, written to both halves of a bail-out: the line in the report and the closing roll-up.
skip() {
  echo "  skipped: $1"
  unreadable+=("/$skill — $1")
}

# --- report -------------------------------------------------------------------------------------
# `.claude/skills/sync-upstream/SKILL.md` matches several literal report strings below
# (`skipped:`, `could not fetch`, `upstream only`, `upstream copy unreadable`, the tag line):
# reword them there in the same edit.

declare -A tree_fetched=()
unreadable=()
total_files=0
total_lines=0
total_unread=0

for skill in "${skills[@]}"; do
  fork_dir="$repo/skills/$skill"
  echo
  echo "════ /$skill"

  if [ ! -f "$fork_dir/SKILL.md" ]; then
    skip "skills/$skill/SKILL.md does not exist."
    continue
  fi

  # --- which upstream, at which tag ---

  line=$(awk 'NR == 1 { if ($0 != "---") exit; next }
              $0 == "---" { exit }
              /^source:/ { print; exit }' "$fork_dir/SKILL.md")

  if [ -z "$line" ]; then
    skip "no source: line in the frontmatter — not a fork."
    continue
  fi

  # Free prose may follow the parenthesized upstream name, so the parser stops at the parenthesis.
  source_re='^source:[[:space:]]*([^[:space:]@]+)@([^[:space:](]+)[[:space:]]*\(([^)]+)\)'

  if [[ ! "$line" =~ $source_re ]]; then
    skip "the source: line could not be parsed."
    continue
  fi

  src_repo="${BASH_REMATCH[1]}"
  src_version="${BASH_REMATCH[2]}"
  src_name="${BASH_REMATCH[3]}"

  if ! pin_tag=$(tag_for "$src_repo" "$src_version"); then
    skip "unknown upstream '$src_repo' — no tag prefix is recorded for it."
    continue
  fi

  tag="${tag_override:-$pin_tag}"
  slug="${src_repo//\//-}"

  echo "     $src_repo@$src_version → $tag, upstream skill '$src_name'"

  # --- the upstream tree, and the skill's real path inside it ---

  tree="$cache_root/$slug/$tag/.tree"
  # A refresh re-fetches a tree once per run, not once per fork sharing it.
  if [ ! -s "$tree" ] || { [ "$refresh" -eq 1 ] && [ -z "${tree_fetched["$slug/$tag"]:-}" ]; }; then
    if ! fetch_to "$tree" "repos/$src_repo/git/trees/$tag?recursive=1" \
         --jq '.tree[] | select(.type == "blob") | .sha + "\t" + .path'; then
      skip "could not read the tree of $src_repo at $tag."
      continue
    fi
  fi
  tree_fetched["$slug/$tag"]=1

  # One pass over the listing yields both the upstream skill's real directory — nested under
  # skills/engineering/ or skills/productivity/ in one upstream — and the blob sha of every file,
  # which is what makes a cache entry verifiable rather than merely present.
  tree_paths=()
  tree_shas=()
  upstream_dir=""

  while IFS=$'\t' read -r sha path; do
    tree_paths+=("$path")
    tree_shas+=("$sha")

    case "$path" in
      "$src_name/SKILL.md"|*/"$src_name"/SKILL.md) upstream_dir="${path%/SKILL.md}" ;;
    esac
  done < "$tree"

  if [ -z "$upstream_dir" ]; then
    skip "no '$src_name/SKILL.md' in $src_repo at $tag."
    continue
  fi

  echo "     upstream path $upstream_dir"

  # --- the upstream file set, and its cache ---

  up_cache="$cache_root/$slug/$tag/$upstream_dir"
  up_files=()
  declare -A sha_for=()

  for i in "${!tree_paths[@]}"; do
    path="${tree_paths[$i]}"

    case "$path" in
      "$upstream_dir"/*) ;;
      *) continue ;;
    esac

    rel="${path#"$upstream_dir"/}"
    up_files+=("$rel")
    sha_for["$rel"]="${tree_shas[$i]}"
  done

  # A cached file counts only when its bytes hash to the blob sha the tree recorded: presence alone
  # would let a truncated fetch or a hand-placed file confirm whatever finding it produced.
  # --stdin-paths hashes the whole set in one git process rather than one per file.
  declare -A cached=()

  if [ "$refresh" -eq 0 ]; then
    present=()

    for rel in "${up_files[@]}"; do
      if [ -f "$up_cache/$rel" ]; then
        present+=("$rel")
      fi
    done

    if [ ${#present[@]} -gt 0 ]; then
      # Repo-relative under `git -C`, because a path arriving on stdin gets none of the POSIX-to-
      # Windows conversion an argv path does, and git would fail to open every one of them.
      i=0

      while IFS= read -r hash; do
        if [ "$hash" = "${sha_for[${present[$i]}]}" ]; then
          cached["${present[$i]}"]=1
        fi
        i=$((i + 1))
      done < <(printf '%s\n' "${present[@]/#/${up_cache#"$repo"/}/}" \
        | git -C "$repo" hash-object --no-filters --stdin-paths)
    fi
  fi

  # An unreadable upstream file is recorded by name: absence alone is indistinguishable from the
  # fork having added a file, and reporting it as one would invent a divergence upstream lacks.
  declare -A unread=()

  for rel in "${up_files[@]}"; do
    [ -z "${cached[$rel]:-}" ] || continue

    if ! fetch_to "$up_cache/$rel" -H "Accept: application/vnd.github.raw" \
         "repos/$src_repo/contents/$upstream_dir/$rel?ref=$tag"; then
      echo "  ! could not fetch $upstream_dir/$rel"
      unread["$rel"]=1
      continue
    fi

    if [ "$(git hash-object --no-filters "$up_cache/$rel")" != "${sha_for[$rel]}" ]; then
      echo "  ! $upstream_dir/$rel does not match its blob sha"
      unread["$rel"]=1
    fi
  done

  if [ ${#unread[@]} -gt 0 ]; then
    echo "  ! ${#unread[@]} upstream file(s) unreadable — listed below, uncompared."
    total_unread=$((total_unread + ${#unread[@]}))
  fi

  # --- the comparison ---

  # Union of both sides: a shipped script or template drifts like any other fork text, and a file
  # only one side has is a divergence in its own right.
  fork_files=()

  while IFS= read -r f; do
    fork_files+=("${f#"$fork_dir"/}")
  done < <(find "$fork_dir" -type f)

  skill_lines=0

  while IFS= read -r rel; do
    [ -n "$rel" ] || continue

    up="$up_cache/$rel"
    fk="$fork_dir/$rel"

    if [ -n "${unread[$rel]:-}" ]; then
      # One-sidedness is knowable from the tree listing alone, so it is still reported as such;
      # only the comparison needs the bytes the fetch failed to get.
      if [ -f "$fk" ]; then
        echo "  ?  $rel — upstream copy unreadable, not compared"
      else
        echo "  −  $rel — upstream only, absent from the fork (size unknown, fetch failed)"
      fi
      n=0
    elif [ -f "$up" ] && [ -f "$fk" ]; then
      # One diff per pair serves as both the report and the count: every divergent line on either
      # side is one of the -/+ lines below the two -/+++ headers.
      out=$(diff -u --label "upstream/$rel" --label "fork/$rel" "$up" "$fk" || true)
      n=0

      if [ -n "$out" ]; then
        # Counted by parameter expansion rather than a read loop: a here-string is backed by a temp
        # file, which on Windows costs about 5ms per divergent file and buys nothing here.
        stripped="${out//$'\n'-/}"
        n=$(( (${#out} - ${#stripped}) / 2 ))

        stripped="${out//$'\n'+/}"
        n=$(( n + (${#out} - ${#stripped}) / 2 ))

        # Both counts skip the leading `---` header, which has no newline before it, so the `+++`
        # header is the only one still included.
        n=$((n - 1))
      fi

      if [ "$n" -eq 0 ]; then
        echo "  ·  $rel — identical"
      else
        echo "  ✗  $rel — $n divergent lines"
        printf '%s\n' "$out"
      fi
    elif [ -f "$fk" ]; then
      # The arithmetic strips the leading blanks BSD wc pads its count with, which would otherwise
      # print verbatim in the line below on macOS.
      n=$(( $(wc -l < "$fk") ))
      echo "  +  $rel — fork only, no upstream counterpart ($n lines)"
    else
      n=$(( $(wc -l < "$up") ))
      echo "  −  $rel — upstream only, absent from the fork ($n lines)"
    fi

    if [ "$n" -gt 0 ]; then
      skill_lines=$((skill_lines + n))
      total_files=$((total_files + 1))
    fi
  done < <(printf '%s\n' "${up_files[@]}" "${fork_files[@]}" | sort -u)

  echo "     total: $skill_lines divergent lines"
  total_lines=$((total_lines + skill_lines))
done

echo
echo "──── $total_lines divergent lines across $total_files files."
# One per line: the reasons carry em-dashes of their own, so a space-joined list runs together.
if [ ${#unreadable[@]} -gt 0 ]; then
  echo "     not read:"
  printf '       %s\n' "${unreadable[@]}"
fi
if [ "$total_unread" -gt 0 ]; then
  echo "     $total_unread upstream file(s) were unreadable — the totals above exclude them."
fi
echo "     cache: .scratch/sync/ — gitignored, and safe to delete wholesale at any time."
exit 0
