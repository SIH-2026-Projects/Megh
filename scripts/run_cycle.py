"""Run a single MEGH operational-style cycle.

In production, replace the demo grid call with the real ingestion and verification jobs.
The command writes a versioned JSON artifact for downstream systems.
"""
import argparse, json
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backend.app.services.fusion import grid_features
from backend.app.services.operational import cycle_status

p=argparse.ArgumentParser(); p.add_argument('--variable',default='rainfall'); p.add_argument('--lead',type=int,default=48); p.add_argument('--output',default='artifacts/cycle.json'); a=p.parse_args()
out=Path(a.output); out.parent.mkdir(parents=True,exist_ok=True)
payload={"cycle":cycle_status(),"variable":a.variable,"lead_hours":a.lead,"features":grid_features(a.variable,a.lead,1.25)}
out.write_text(json.dumps(payload,indent=2))
print(f'wrote {out}')
