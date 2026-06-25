# DB 마이그레이션 (Alembic)

스키마는 **Alembic 마이그레이션이 단일 소스**다. `create_all` 은 쓰지 않는다
(앱/로더에서 제거됨). 모든 명령은 `backend/` 에서, `cdss` conda 환경 활성화 후 실행.

```bash
source ~/miniconda3/etc/profile.d/conda.sh && conda activate cdss
cd "/home/team4/Final _project/backend"
```

## 일상 작업

| 목적 | 명령 |
|---|---|
| 최신 스키마로 DB 맞추기 | `alembic upgrade head` |
| 현재 리비전 확인 | `alembic current` |
| 이력 보기 | `alembic history` |
| 모델↔DB 드리프트 검사 | `alembic check` (No new operations = 일치) |
| 한 단계 되돌리기 | `alembic downgrade -1` |

## 모델을 바꿨을 때 (컬럼 추가/수정 등)

1. `patients/models.py` 등 모델 수정
2. 마이그레이션 자동 생성:
   ```bash
   alembic revision --autogenerate -m "무엇을 바꿨는지"
   ```
3. 생성된 `alembic/versions/*.py` **반드시 눈으로 검토** (autogenerate가 놓치는 경우 있음: 컬럼 rename, 타입 변경, JSONB 등)
4. 적용: `alembic upgrade head`

## 예정된 적용 예시

- **[추후입력] 값 채우기**(classification_cancer/bp/familyhistory): 컬럼은 이미 존재 → 마이그레이션 불필요, `UPDATE` 또는 재적재만.
- **라디오믹스 도착**: `radiomics_features` 테이블 이미 존재 → `load_radiomics.py` 로 적재만.
- **새 컬럼/파생변수 추가**: 위 "모델을 바꿨을 때" 절차.

## 접속 정보

DB 주소는 `.env` 의 `database_url` 에서 읽는다(.ini 하드코딩 아님, `alembic/env.py` 가 설정 사용).
DB 기동은 [db-setup 메모] 참고: `pg_ctl -D ~/cdss_pgdata -l ~/cdss_pg.log -o "-p 5432" start`

## 데이터 (재)적재

스키마(`alembic upgrade head`) 후:
```bash
python load_csv_to_db.py            # 임상 278명 (멱등: 비우고 재적재; CSV에 6컬럼 합성값 포함)
# python load_radiomics.py <csv>    # (라디오믹스 도착 시)
```
> 6컬럼(classification_cancer/surgical_cancer_t/n/m/bp/familyhistory)은 **합성(가상) 최종값**으로
> 이미 `clinical_data_schema.csv` 에 들어 있다. CSV를 `transform...py` 로 재생성한 경우에만
> `fill_deferred_columns.py` 를 다시 돌려 합성값을 채운 뒤 load 한다.
