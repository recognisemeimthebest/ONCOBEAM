import json
import phase2_baseline

with open('config.json', encoding='utf-8') as f:
	cfg = json.load(f)

phase2_baseline.run(cfg)
