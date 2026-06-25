"""pytest 공용 설정 — backend 를 import 경로에 추가하고 가벼운 환자 더미 제공."""
import os
import sys
from types import SimpleNamespace
from datetime import date

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def make_patient(**overrides):
    """DB 없이 features 로직을 테스트하기 위한 환자 더미.

    Patient ORM 과 동일한 속성명을 갖되, 기본값은 전형적 두경부암 환자.
    """
    base = dict(
        patient_id="QIN-TEST-0001",
        sex="M", birth_date="195001", height=170, weight=70,
        cancerimaging="4a", cancerimaging_t="4a", cancerimaging_n="2b", cancerimaging_m="0",
        bs="N", sm="Y", bp=None, familyhistory=None, classification_cancer=None,
        totaldose=70, radiationperdose=2.0, radiationcnt=35,
        treatmethod=2, treatech=3,
        involmentrenal=True, lymphrenal=False, boundary_surgical=1,
        initialdate=date(2000, 1, 10), treatedate=date(2000, 3, 1),
        relapse=1, relapsedate=None,
        dead=0, deathdate=None, deathsign=None, lastdate=date(2006, 1, 10),
    )
    base.update(overrides)
    return SimpleNamespace(**base)


@pytest.fixture
def patient():
    return make_patient
