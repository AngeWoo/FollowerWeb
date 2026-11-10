#!/bin/bash
# 在 Mac 上雙擊執行：掃描 DOC/notice、calendar、download，產生 DOC/manifest.json
# 之後把 DOC 資料夾（含 manifest.json）整個上傳到網站即可。
cd "$(dirname "$0")" || exit 1
esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
out="DOC/manifest.json"; tmp=$(mktemp)
{
  printf '{'
  firstsec=1
  for sec in notice calendar download; do
    [ $firstsec -eq 1 ] || printf ','; firstsec=0
    printf '"%s":[' "$sec"
    first=1
    for f in DOC/$sec/*; do
      [ -f "$f" ] || continue
      base=$(basename "$f")
      case "$base" in .*) continue;; esac
      ext=$(printf '%s' "${base##*.}" | tr 'A-Z' 'a-z')
      case "$ext" in pdf|doc|docx) ;; *) continue;; esac
      size=$(stat -f %z "$f"); date=$(stat -f %Sm -t %Y-%m-%d "$f")
      [ $first -eq 1 ] || printf ','; first=0
      printf '{"name":"%s","file":"%s","ext":"%s","size":%s,"date":"%s"}' "$(esc "${base%.*}")" "$(esc "$base")" "$ext" "$size" "$date"
    done
    printf ']'
  done
  printf '}'
} > "$tmp" && mv "$tmp" "$out"
echo "完成：$out"; grep -o '"file"' "$out" | wc -l | xargs echo "共 N 個檔案 =>"
read -n 1 -s -r -p "按任意鍵關閉…"
