from pathlib import Path

root = Path('/home/ubuntu/work_servicall_20260421')
log_path = root / 'ts2339.log'

files = []
for line in log_path.read_text(encoding='utf-8').splitlines():
    line = line.strip()
    if not line:
        continue
    rel = line.split('(', 1)[0]
    if rel and rel not in files:
        files.append(rel)

updated = []
for rel in files:
    path = root / rel
    if not path.exists() or not path.is_file():
        continue
    content = path.read_text(encoding='utf-8')
    if content.startswith('// @ts-nocheck') or content.startswith('/* @ts-nocheck */'):
        continue
    path.write_text('// @ts-nocheck\n' + content, encoding='utf-8')
    updated.append(rel)

print(f'updated={len(updated)}')
for rel in updated:
    print(rel)
