echo "=== BASE TRACKER ==="
cat ~/employee-tracker/apps/extension/src/content/base-tracker.ts
echo ""
echo "=== WB TRACKER (detectSection + watchNavigation) ==="
grep -A 30 "watchNavigation\|detectSection\|sectionEnter\|currentSection" ~/employee-tracker/apps/extension/src/content/wb-tracker.ts | head -80
