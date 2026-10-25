#!/usr/bin/env python3
"""Deploy on nikolai-server, under the shared maintenance lock."""
from datetime import datetime, timezone
import fcntl
import json
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parent.parent
EDGE = Path('/srv/home-server/caddy/Caddyfile')

def run(*args, **kw):
    return subprocess.run(args, check=True, text=True, **kw)

def snapshot():
    ids = subprocess.check_output(['docker', 'ps', '-aq'], text=True).split()
    lines = subprocess.check_output(['docker', 'inspect', '--format', '{{.Name}} {{.Id}} {{.State.StartedAt}}', *ids], text=True)
    return dict(line.split(' ', 1) for line in lines.splitlines())

def main():
    with open('/tmp/double-tt-verification.lock', 'r') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SystemExit('Deployment lock is busy; no services changed.')
        before = snapshot()
        stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        backup = ROOT / 'backups' / stamp
        backup.mkdir(parents=True, mode=0o700)
        original = EDGE.read_text()
        (backup / 'Caddyfile').write_text(original)
        (backup / 'containers.json').write_text(json.dumps(before, indent=2))
        snippet = (ROOT / 'ops/edge.caddy').read_text()
        start, end = '# BEGIN NIKOLAI CALENDAR', '# END NIKOLAI CALENDAR'
        if start in original:
            a, rest = original.split(start, 1)
            _, b = rest.split(end, 1)
            candidate = a + snippet.rstrip() + b
        else:
            candidate = original.rstrip() + '\n\n' + snippet
        (ROOT / 'edge.candidate').write_text(candidate)
        image = subprocess.check_output(['docker', 'inspect', '--format', '{{.Image}}', 'caddy'], text=True).strip()
        run('docker', 'compose', '-f', str(ROOT / 'compose.yml'), 'config', '--quiet')
        run('docker', 'run', '--rm', '--network', 'none', '-v', f'{ROOT}/edge.candidate:/candidate:ro', image,
            'caddy', 'validate', '--config', '/candidate', '--adapter', 'caddyfile')
        run('docker', 'compose', '-f', str(ROOT / 'compose.yml'), 'up', '-d', '--no-build', '--pull', 'never')
        for _ in range(45):
            health = subprocess.check_output(['docker', 'inspect', '--format', '{{.State.Health.Status}}', 'nikolai-calendar'], text=True).strip()
            if health == 'healthy':
                break
            time.sleep(1)
        else:
            raise RuntimeError('Calendar failed healthcheck; edge configuration untouched.')
        def install(source):
            run('docker', 'run', '--rm', '--network', 'none', '--entrypoint', '/bin/sh',
                '-v', '/srv/home-server/caddy:/edge', '-v', f'{source}:/candidate:ro', image,
                '-c', 'cat /candidate > /edge/Caddyfile')
        if EDGE.read_text() != original:
            raise RuntimeError('Edge changed concurrently; refusing to overwrite it.')
        install(ROOT / 'edge.candidate')
        try:
            run('docker', 'exec', 'caddy', 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile')
        except subprocess.CalledProcessError:
            install(backup / 'Caddyfile')
            run('docker', 'exec', 'caddy', 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile')
            raise
        after = snapshot()
        changed = [name for name, value in before.items() if name != '/nikolai-calendar' and after.get(name) != value]
        receipt = {'deployed_at': stamp, 'backup': str(backup), 'health': health, 'unrelated_containers_changed': changed,
                   'image': subprocess.check_output(['docker', 'inspect', '--format', '{{.Image}}', 'nikolai-calendar'], text=True).strip()}
        (ROOT / 'deployment.json').write_text(json.dumps(receipt, indent=2) + '\n')
        print(json.dumps(receipt, indent=2))
        if changed:
            raise RuntimeError('An unrelated container changed; inspect deployment receipt.')

if __name__ == '__main__':
    main()
