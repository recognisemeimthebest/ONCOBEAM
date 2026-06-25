import json
#import phase4_xlearner
#import phase4_drlearner
import phase4_causalforest

with open('config.json', encoding='utf-8') as f:
	cfg = json.load(f)

#phase4_xlearner.run(cfg)
#phase4_drlearner.run(cfg)
phase4_causalforest.run(cfg)
