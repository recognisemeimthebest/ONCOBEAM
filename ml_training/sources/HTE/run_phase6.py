import json
import phase6_subgroup

with open('config.json', encoding='utf-8') as f:
	cfg = json.load(f)

phase6_subgroup.run(cfg)
