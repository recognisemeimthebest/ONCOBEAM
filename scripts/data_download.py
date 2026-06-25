from tcia_utils import nbia
import os

save_path = "/home/team4/Final_project_img"
os.makedirs(save_path, exist_ok=True)

print("QIN-HEADNECK CT 시리즈 목록 조회 중...")
series = nbia.getSeries(collection="QIN-HEADNECK", modality="CT")
print(f"총 {len(series)}개 CT 시리즈 발견")

print("다운로드 시작...")
nbia.downloadSeries(series, path=save_path)
print("완료!")