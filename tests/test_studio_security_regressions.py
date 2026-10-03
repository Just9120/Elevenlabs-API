"""Synthetic security regressions; no credentials, paid providers or production state."""
import asyncio
import json
import logging
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'apps/studio-api'))
if 'STUDIO_DATABASE_HOST' not in os.environ:
    os.environ.setdefault('STUDIO_DATABASE_URL', 'sqlite+pysqlite:///:memory:')


def test_presigned_single_and_part_lengths_are_in_sigv4_signature():
    import boto3
    from botocore.config import Config
    from studio_api.source_storage import S3SourceStorage

    storage = object.__new__(S3SourceStorage)
    storage.bucket = 'test-private'
    storage.client = boto3.client('s3', endpoint_url='https://storage.test',
        region_name='auto', aws_access_key_id='synthetic-access',
        aws_secret_access_key='synthetic-secret', config=Config(signature_version='s3v4'))
    single = storage.presigned_put_url('owner/key', 'audio/flac', 300, 123)
    part = storage.presigned_upload_part_url('owner/key', 'upload-id', 2, 300, 19)
    for url in (single, part):
        signed = parse_qs(urlsplit(url).query)['X-Amz-SignedHeaders'][0].split(';')
        assert 'content-length' in signed
    # A changed length produces a different signature, not merely a metadata hint.
    changed = storage.presigned_put_url('owner/key', 'audio/flac', 300, 124)
    assert parse_qs(urlsplit(single).query)['X-Amz-Signature'] != parse_qs(urlsplit(changed).query)['X-Amz-Signature']


@pytest.mark.parametrize('mismatch', ['absent', 'other', 'revoked', 'expired', 'disabled', 'valid'])
def test_oauth_requires_exact_active_initiating_session(mismatch):
    from studio_api.db import Base
    from studio_api.models import User, Session as DbSession, UserStatus
    from studio_api.oauth_session import lock_oauth_initiator
    from studio_api.security import token_hash

    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine, tables=[User.__table__, DbSession.__table__])
    now = datetime(2026, 10, 3)
    with Session(engine) as db:
        user = User(id='owner', email='owner@example.test')
        session = DbSession(id='session', user_id=user.id, token_hash=token_hash('initiator'),
            csrf_hash=token_hash('csrf'), expires_at=now + timedelta(hours=1))
        db.add_all([user, session]); db.commit()
        raw = 'initiator'
        if mismatch == 'absent': raw = None
        if mismatch == 'other': raw = 'other-browser'
        if mismatch == 'revoked': session.revoked_at = now
        if mismatch == 'expired': session.expires_at = now
        if mismatch == 'disabled': user.status = UserStatus.disabled
        db.flush()
        state = SimpleNamespace(session_id=session.id, user_id=user.id)
        result = lock_oauth_initiator(db, state=state, raw_session=raw, now=now)
        assert (result is session) == (mismatch == 'valid')
    engine.dispose()


def test_body_guard_bounds_auth_and_chunked_bodies_before_handler():
    from studio_api.http_limits import RequestBodyLimitMiddleware

    app = FastAPI()
    app.add_middleware(RequestBodyLimitMiddleware)
    calls = []

    @app.post('/api/auth/login')
    @app.post('/api/draft')
    async def post(request: Request):
        body = await request.json()
        calls.append(body)
        return {'ok': True}

    client = TestClient(app)
    assert client.post('/api/auth/login', content=b'x' * 16385).status_code == 413
    assert calls == []
    # UTF-8 and JSON-escaped worst case for an otherwise valid full draft fits.
    draft = {'committed_segments': ['\u0001' * 20000] * 25, 'partial': '\u0001' * 20000}
    assert client.post('/api/draft', content=json.dumps(draft), headers={'content-type': 'application/json'}).status_code == 200
    assert calls == [draft]

    async def invoke():
        downstream = []
        messages = iter([
            {'type': 'http.request', 'body': b'a' * 8, 'more_body': True},
            {'type': 'http.request', 'body': b'b' * 8, 'more_body': False},
        ])
        async def handler(*args): downstream.append(True)
        async def receive(): return next(messages)
        sent = []
        async def send(message): sent.append(message)
        await RequestBodyLimitMiddleware(handler, max_bytes=10)(
            {'type': 'http', 'path': '/api/draft', 'headers': []}, receive, send)
        assert downstream == []
        assert sent[0]['status'] == 413
    asyncio.run(invoke())


@pytest.mark.parametrize('kind', ['http', 'ws-accepted', 'ws-rejected'])
def test_actual_uvicorn_formatters_hide_oauth_and_websocket_queries(kind):
    from studio_api.safe_server_logs import QueryRedactionFilter
    from uvicorn.logging import AccessFormatter, DefaultFormatter

    if kind == 'http':
        record = logging.LogRecord('uvicorn.access', logging.INFO, '', 0,
            '%s - "%s %s HTTP/%s" %d', ('127.0.0.1:1', 'GET', '/api/google/oauth/callback?code=SECRET_CODE&state=SECRET_STATE', '1.1', 303), None)
        formatter = AccessFormatter(fmt='%(request_line)s %(status_code)s', use_colors=False)
    else:
        status = '[accepted]' if kind == 'ws-accepted' else '403'
        record = logging.LogRecord('uvicorn.error', logging.INFO, '', 0,
            '%s - "WebSocket %s" %s', ('127.0.0.1:1', '/api/realtime/yandex?capability=SECRET_CAPABILITY', status), None)
        formatter = DefaultFormatter('%(message)s')
    QueryRedactionFilter().filter(record)
    output = formatter.format(record)
    assert 'SECRET_' not in output and '?' not in output
    assert '/api/' in output
    config = json.loads((ROOT / 'apps/studio-api/uvicorn-log-config.json').read_text())
    assert all('safe_query' in config['handlers'][name]['filters'] for name in ('access', 'default'))
    assert '--log-config' in (ROOT / 'apps/studio-api/Dockerfile').read_text()


def test_yandex_capability_consumption_is_atomic_and_failure_closed():
    from threading import Lock
    from redis.exceptions import ConnectionError
    from studio_api.yandex_realtime_relay import consume_yandex_realtime_capability, YandexRealtimeCapabilityError

    authority = SimpleNamespace(nonce='synthetic-private-nonce', expires_epoch=1300)
    class Store:
        lock = Lock()
        used = False
        def set(self, key, value, *, nx, ex):
            assert nx is True and ex == 299 and 'synthetic-private-nonce' not in key
            with self.lock:
                if self.used: return False
                self.used = True
                return True
    store = Store()
    def consume(_):
        try:
            consume_yandex_realtime_capability(authority, settings=None, redis=store, now_epoch=1001)
            return True
        except YandexRealtimeCapabilityError:
            return False
    with ThreadPoolExecutor(max_workers=8) as pool:
        assert sum(pool.map(consume, range(16))) == 1
    class Unavailable:
        def set(self, *a, **k): raise ConnectionError('synthetic failure')
    with pytest.raises(YandexRealtimeCapabilityError, match='capability_store_unavailable'):
        consume_yandex_realtime_capability(authority, settings=None, redis=Unavailable(), now_epoch=1001)
    with pytest.raises(YandexRealtimeCapabilityError, match='expired_capability'):
        consume_yandex_realtime_capability(authority, settings=None, redis=store, now_epoch=1300)


def test_relay_rejects_replay_before_websocket_accept_and_provider_call(monkeypatch):
    import studio_api.yandex_realtime_relay as relay
    events = []
    monkeypatch.setattr(relay, 'decode_yandex_realtime_capability', lambda *a, **k: object())
    monkeypatch.setattr(relay, '_open_api_key', lambda *a, **k: 'synthetic-key')
    def used(*a, **k): raise relay.YandexRealtimeCapabilityError('capability_already_used')
    monkeypatch.setattr(relay, 'consume_yandex_realtime_capability', used)
    monkeypatch.setattr(relay.grpc.aio, 'secure_channel', lambda *a, **k: pytest.fail('paid call'))
    class Socket:
        headers = {'origin': 'https://studio.test'}
        async def close(self, *, code): events.append(code)
        async def accept(self): pytest.fail('accepted replay')
    asyncio.run(relay.relay_yandex_realtime(Socket(), capability='synthetic', settings=SimpleNamespace(app_origin='https://studio.test')))
    assert events == [4403]


def test_colab_html_widgets_render_external_labels_as_text():
    import ast
    from html import escape
    source = (ROOT / "elevenlabs_api.py").read_text(encoding="utf-8")
    module = ast.parse("\n".join(line for line in source.splitlines() if not line.lstrip().startswith("!")))
    selected = [node for node in module.body if isinstance(node, ast.FunctionDef) and node.name in {
        "set_progress", "refresh_folder_picker", "refresh_source_picker", "format_drive_multi_summary_html"}]
    # Execute real widget template assignments without mounting Drive or importing Colab.
    malicious = '<img src=x onerror="attack()"> & named'
    namespace = {"escape_html": escape, "str": str, "current_path": malicious,
        "folder_picker_state": {"selected_path": malicious, "selected_id": malicious},
        "source_picker_state": {"selected_label": malicious}, "selected_details": malicious}
    assignments = []
    for node in ast.walk(ast.Module(body=[n for n in selected if n.name != "set_progress"], type_ignores=[])):
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Attribute) and t.attr == "value" for t in node.targets):
            if isinstance(node.value, ast.JoinedStr) and any(isinstance(x, ast.Constant) and '<' in str(x.value) for x in node.value.values):
                assignments.append(node.value)
    assert len(assignments) >= 4
    for value in assignments:
        output = eval(compile(ast.Expression(value), '<widget-template>', 'eval'), namespace)
        assert malicious not in output
        assert escape(malicious) in output
    progress = next(node for node in selected if node.name == "set_progress")
    progress_bar = SimpleNamespace(layout=SimpleNamespace(visibility=""), send_state=lambda: None)
    progress_label = SimpleNamespace(value="", send_state=lambda: None)
    namespace.update(progress_bar=progress_bar, progress_label=progress_label, time=SimpleNamespace(sleep=lambda *a: None))
    exec(compile(ast.Module(body=[progress], type_ignores=[]), '<progress>', 'exec'), namespace)
    namespace['set_progress'](1, 2, malicious)
    assert escape(malicious) in progress_label.value and '<img' not in progress_label.value
