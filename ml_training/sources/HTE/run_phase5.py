import json
import phase5_shap

with open('config.json', encoding='utf-8') as f:
	cfg = json.load(f)

phase5_shap.run(cfg)
