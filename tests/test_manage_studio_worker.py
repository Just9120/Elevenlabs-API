from __future__ import annotations

import os, stat, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/manage_studio_worker.sh"


def exe(p: Path, s: str):
    p.write_text(s); p.chmod(p.stat().st_mode | stat.S_IXUSR)


def run_cmd(tmp_path: Path, cmd: str, **state: str):
    bindir=tmp_path/'bin'; bindir.mkdir(parents=True); log=tmp_path/'calls.log'
    status=state.get('status','absent'); health=state.get('health','healthy'); image=state.get('image','sha256:img'); exitcode=state.get('exit','0')
    exe(bindir/'git', f"#!/usr/bin/env bash\necho git $* >> {str(log)!r}\n[[ '$*' == 'rev-parse HEAD' ]] && echo {'a'*40}\n")
    exe(bindir/'sleep', f"#!/usr/bin/env bash\necho sleep $* >> {str(log)!r}\n")
    exe(bindir/'docker', f'''#!/usr/bin/env bash
set -euo pipefail
echo docker $* >> {str(log)!r}
if [[ "$1" == compose ]]; then
 shift; while [[ "$1" == --env-file || "$1" == -f ]]; do shift 2; done
 case "$1" in
  ps) [[ {status!r} == absent ]] || echo cid ;;
  up) echo up ;;
  run) [[ "${{@: -1}}" == current ]] && echo abc || echo abc ;;
  *) exit 7;;
 esac
elif [[ "$1" == inspect ]]; then
 fmt="$3"
 if [[ "$fmt" == *State.Status* ]]; then [[ {status!r} == stopped ]] && echo exited || echo running; elif [[ "$fmt" == *State.Health* ]]; then echo {health!r}; elif [[ "$fmt" == *State.ExitCode* ]]; then echo {exitcode!r}; else echo {image!r}; fi
elif [[ "$1 $2" == "image inspect" ]]; then [[ {state.get('rollback','present')!r} == present ]] || exit 1; if [[ "$*" == *--format* ]]; then echo {state.get('rollback_image','sha256:img')!r}; fi
elif [[ "$1" == stop ]]; then echo cid
elif [[ "$1" == start ]]; then echo cid
elif [[ "$1" == tag ]]; then echo tag
else exit 8
fi
''')
    env_file = ROOT / 'deploy/studio/.env'
    created = not env_file.exists()
    if created:
        env_file.write_text('STUDIO_WORKER_LEASE_TTL_SECONDS=300\n')
    env={**os.environ,'PATH':f"{bindir}:{os.environ['PATH']}",'STUDIO_DEPLOY_DIR':str(ROOT),'STUDIO_WORKER_LEASE_TTL_SECONDS':'300'}
    env.update(state.get('env',{}))
    try:
        proc=subprocess.run(['bash',str(SCRIPT),cmd],cwd=ROOT,env=env,text=True,capture_output=True,timeout=10)
    finally:
        if created:
            env_file.unlink()
    calls=log.read_text().splitlines() if log.exists() else []
    return proc,calls


def forbidden(calls):
    joined='\n'.join(calls)
    assert ' compose down' not in joined and ' pause' not in joined and 'SIGSTOP' not in joined and 'prune' not in joined


def test_status_absent_running_stopped(tmp_path):
    for st in ['absent','running','stopped']:
        p,c=run_cmd(tmp_path/st,'status',status=st)
        assert p.returncode==0
        assert 'STUDIO_WORKER_STATUS_OK' in p.stdout
        forbidden(c)


def test_drain_idle_and_active_graceful(tmp_path):
    p,c=run_cmd(tmp_path/'idle','drain',status='absent')
    assert p.returncode==0 and 'STUDIO_WORKER_DRAINED' in p.stdout
    p,c=run_cmd(tmp_path/'active','drain',status='stopped',exit='0')
    assert p.returncode==0 and 'STUDIO_WORKER_DRAINED' in p.stdout
    assert any('docker stop --time 360 cid' in x for x in c)
    forbidden(c)


def test_forced_kill_fails(tmp_path):
    p,c=run_cmd(tmp_path/'kill','drain',status='running',exit='137')
    assert p.returncode!=0 and 'STUDIO_WORKER_DRAIN_BLOCKED' in p.stderr
    forbidden(c)


def test_pause_resume_and_missing_resume(tmp_path):
    p,c=run_cmd(tmp_path/'pause','pause',status='absent')
    assert p.returncode==0 and 'STUDIO_WORKER_PAUSED' in p.stdout
    p,c=run_cmd(tmp_path/'resume','resume',status='stopped')
    assert p.returncode==0 and 'STUDIO_WORKER_RESUMED' in p.stdout
    p,c=run_cmd(tmp_path/'missing','resume',status='absent')
    assert p.returncode!=0 and 'official worker deploy path' in p.stderr
    forbidden(c)


def test_rollback_missing_mismatch_success(tmp_path):
    p,c=run_cmd(tmp_path/'missingrb','rollback',status='stopped',rollback='absent')
    assert p.returncode!=0 and 'rollback candidate missing' in p.stderr
    p,c=run_cmd(tmp_path/'ok','rollback',status='stopped')
    assert p.returncode==0 and 'STUDIO_WORKER_ROLLBACK_OK' in p.stdout
    assert any('compose --env-file deploy/studio/.env -f deploy/studio/compose.platform.yml up -d --no-deps --force-recreate studio-worker' in x for x in c)
    forbidden(c)
