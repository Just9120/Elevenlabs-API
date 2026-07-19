from __future__ import annotations
import sys
from datetime import datetime, timedelta
from pathlib import Path
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0, str(ROOT/"apps/studio-api"))
@pytest.fixture()
def db():
    from studio_api.db import Base
    import studio_api.models
    engine=create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread":False}, poolclass=StaticPool); Base.metadata.create_all(engine)
    S=sessionmaker(bind=engine, expire_on_commit=False); s=S()
    try: yield s
    finally: s.close(); Base.metadata.drop_all(engine); engine.dispose()

def make_failed(db, sources=1):
    from studio_api import models as m
    now=datetime(2026,1,2,3,4,5)
    u=m.User(email=f"{id(db)}@e.test", role=m.UserRole.user, status=m.UserStatus.active); db.add(u); db.flush()
    p=m.Project(owner_user_id=u.id,title="p"); db.add(p); db.flush()
    j=m.TranscriptionJob(project_id=p.id, owner_user_id=u.id, status=m.JobStatus.failed, error_code="output_reconciliation_required", output_drive_folder_id="folder-private", lease_generation=7, attempt_count=1); db.add(j); db.flush()
    rels=[]
    for i in range(sources):
        src=m.Source(project_id=p.id, source_type=m.SourceType.local_upload, original_filename=f"a{i}.mp3", upload_status=m.SourceUploadStatus.uploaded, s3_object_key="k", uploaded_at=now); db.add(src); db.flush()
        r=m.TranscriptionJobSource(job_id=j.id, source_id=src.id, position=i); db.add(r); db.flush(); rels.append(r)
    db.commit(); return m,u,p,j,rels,now

def add_case(db,m,u,p,j,r,now):
    c=m.TranscriptionOutputReconciliation(owner_user_id=u.id,project_id=p.id,job_id=j.id,job_source_id=r.id,reconciliation_token="or_safeOpaque",lease_generation=7,attempt_number=1,status=m.OutputReconciliationStatus.reconciliation_required,uncertainty_reason="commit_failed",expected_output_drive_folder_id="folder-private",expected_document_title="Title",expected_document_title_hash="h",expected_document_character_count=44,prepared_at=now,creation_started_at=now,created_at=now,updated_at=now); db.add(c); db.commit(); return c

def cand(token="or_safeOpaque", folder="folder-private", mime="application/vnd.google-apps.document", doc="doc-1"):
    from studio_api.job_output_reconciliation import DriveReconciliationCandidate
    return DriveReconciliationCandidate(doc, mime, "https://docs.google.com/document/d/doc-1/edit", (folder,), datetime(2026,1,2,3,4,6), {"studioOutputReconciliationToken": token})

def test_exact_candidate_persists_and_completes_failed_job(db):
    from studio_api.job_output_reconciliation import check_job_output_reconciliation
    m,u,p,j,rels,now=make_failed(db); case=add_case(db,m,u,p,j,rels[0],now)
    res=check_job_output_reconciliation(db, owner_user_id=u.id, job_id=j.id, lookup=lambda token, folder: [cand(token, folder)], now=now)
    assert (res.checked,res.resolved,res.unresolved,res.conflicts)==(1,1,0,0)
    out=db.query(m.TranscriptionJobOutput).one(); assert out.job_source_id==rels[0].id and out.document_id=="doc-1"
    assert case.status==m.OutputReconciliationStatus.resolved and j.status==m.JobStatus.completed

def test_zero_and_multiple_matches_fail_closed(db):
    from studio_api.job_output_reconciliation import check_job_output_reconciliation
    m,u,p,j,rels,now=make_failed(db); c=add_case(db,m,u,p,j,rels[0],now)
    assert check_job_output_reconciliation(db, owner_user_id=u.id, job_id=j.id, lookup=lambda t,f: [], now=now).unresolved==1
    assert db.query(m.TranscriptionJobOutput).count()==0 and c.status==m.OutputReconciliationStatus.reconciliation_required
    assert check_job_output_reconciliation(db, owner_user_id=u.id, job_id=j.id, lookup=lambda t,f: [cand(doc="a"), cand(doc="b")], now=now).conflicts==1
    assert db.query(m.TranscriptionJobOutput).count()==0 and c.status==m.OutputReconciliationStatus.conflict

def test_wrong_identity_blocks_without_body_fetch(db):
    from studio_api.job_output_reconciliation import check_job_output_reconciliation
    m,u,p,j,rels,now=make_failed(db); c=add_case(db,m,u,p,j,rels[0],now)
    res=check_job_output_reconciliation(db, owner_user_id=u.id, job_id=j.id, lookup=lambda t,f: [cand(token="wrong")], now=now)
    assert res.conflicts==1 and db.query(m.TranscriptionJobOutput).count()==0 and c.status==m.OutputReconciliationStatus.conflict
