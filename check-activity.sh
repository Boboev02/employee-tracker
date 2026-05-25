cd ~/employee-tracker/apps/backend
find src -name "*.ts" | xargs grep -l "activity/summary\|activitySummary\|detectSection\|platformData" 2>/dev/null | head -5
