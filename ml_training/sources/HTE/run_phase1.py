import json
import phase1_preprocess

with open('config.json', encoding='utf-8') as f :
	cfg = json.load(f)

phase1_preprocess.run(cfg)
