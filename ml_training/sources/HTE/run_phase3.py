import json
import phase3_psm

with open('config.json', encoding='utf-8') as f:
	cfg = json.load(f)

phase3_psm.run(cfg)
