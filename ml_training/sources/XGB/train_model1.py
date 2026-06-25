import pandas as pd
import numpy as np
from sklearn.linear_model import LassoCV
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.metrics import roc_auc_score, accuracy_score, confusion_matrix, classification_report
import xgboost as xgb
print()

df = pd.read_csv("/home/ubuntu/전처리/validation/model_ready.csv", encoding='utf-8-sig')
y = df['label'].astype(int).values
X = df.drop(columns=['label','patientid'])

rad_cols = [c for c in X.columns if c.startswith(('pre_','post_','delta_'))]
clin_cols = [c for c in X.columns if c not in rad_cols]
print('radiomics:', len(rad_cols),'| clinical:', len(clin_cols))

X_rad = StandardScaler().fit_transform(X[rad_cols].values)
lasso = LassoCV(cv=5, random_state=42, max_iter = 10000)
lasso.fit(X_rad, y)
selected = [rad_cols[i] for i in range(len(rad_cols)) if lasso.coef_[i] !=0]
print('LASSO selected features:', len(selected))
for f in selected:
	print(' ', f)
#===final features===
final_cols = selected + clin_cols
X_final = X[final_cols].values
print('final features:', len(final_cols))

#=== XGBoost 5-fold CV===
neg, pos = (y==0).sum(),(y == 1).sum()
spw = neg/pos
print('imbalance (neg/pos):', round(spw, 2))

model = xgb.XGBClassifier(
	n_estimators=100, max_depth=3, learning_rate=0.1,
	scale_pos_weight=spw, random_state=42, eval_metric='logloss'
)

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
proba = cross_val_predict(model, X_final, y, cv=cv, method = 'predict_proba')[:, 1]
pred = (proba >= 0.5).astype(int)

print()
print('=== result (5-fold CV) ===')
print('AUC:', round(roc_auc_score(y, proba),4))
print('Accuracy:', round(accuracy_score(y, pred),4))
print('Confusion Matrix:')
print(confusion_matrix(y, pred))
print()
print(classification_report(y, pred, target_names=['no event(0)','yes event(1)']))
