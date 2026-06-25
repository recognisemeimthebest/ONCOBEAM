import pandas as pd

out_dir = "/home/ubuntu/전처리/validation/"
df = pd.read_csv(f"{out_dir}/RADIO_ALL_TOTAL.csv")

keywords=["stom","oro","gloss","lingu","phar","lar","rhin","nas","sinus","sial","parot","thyr","sal","gland"]

pattern="|".join(keywords)

mask = df["Diagnosis"].str.contains(pattern, case=False, na=False)
result=df[mask]
result.to_csv(f"{out_dir}/RADIO_HEADANDNECK_TOTAL.csv",index=False, encoding="utf-8-sig")
print("남은건수:",len(result),"/",len(df))
