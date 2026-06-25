import pandas as pd
path = "/home/ubuntu/전처리/RADIO_PRE1.csv"
df = pd.read_csv(path)
print("-"*30)
print(df.shape)
print("-"*30)

print(df['Diagnosis'].value_counts())
keywords=["stom","oro","gloss","lingu","phar","lar","rhin","nas","sinus","sial","parot","thyr","sal","gland"]
pattern = "|".join(keywords)
mask = df["Diagnosis"].str.contains(pattern, case=False,na=False)
result = df[mask]
print(result)
print("-"*30)

#print(df[mask])
print(df[mask]['relapse'].value_counts())
print("-"*30)

print(df[mask]['dead'].value_counts())
print("-"*30)

double =(df[mask]['relapse'].isin([2, 3])) & (df[mask]['dead'] == 1)
result_ids =df[mask].loc[double, 'patientid'].unique()
print("중복: ", len(result_ids))
print("-"*30)

print(df[mask]['treatmethod'].value_counts())
#print(df[mask]['antidrug'].value_counts())
#print(df[mask]['antidrug'].isnull().sum())
#print("-"*30)
