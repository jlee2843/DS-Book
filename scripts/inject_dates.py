import datetime
from pathlib import Path

date = datetime.date.today().strftime("%B %d, %Y")
Path("_last_updated.md").write_text(f"_Last built: {date}_\n")