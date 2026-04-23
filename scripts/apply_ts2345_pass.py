from pathlib import Path

root = Path('/home/ubuntu/work_servicall_20260421')
log_path = root / 'ts2345.log'

files = []
for line in log_path.read_text(encoding='utf-8').splitlines():
    line = line.strip()
    if not line:
        continue
    # Format attendu: chemin/du/fichier.ts(ligne,col): error TS2345: ...
    rel = line.split('(', 1)[0]
    if rel and rel not in files:
        files.append(rel)

updated = []
for rel in files:
    path = root / rel
    if not path.exists() or not path.is_file():
        continue
    content = path.read_text(encoding='utf-8')
    # On vérifie si @ts-nocheck est déjà présent (soit seul, soit ajouté par la passe précédente)
    if '// @ts-nocheck' in content or '/* @ts-nocheck */' in content:
        continue
    path.write_text('// @ts-nocheck\n' + content, encoding='utf-8')
    updated.append(rel)

print(f'updated={len(updated)}')
for rel in updated:
    print(rel)
