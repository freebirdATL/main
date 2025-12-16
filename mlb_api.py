"""
curl "https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=$(date +%Y-%m-%d)&endDate=$(date -v+1d +%Y-%m-%d)" \
| jq '.dates[].games[] | "\(.gamePk) \(.gameDate) \(.description) \(.teams.away.team.name) @ \(.teams.home.team.name)"'