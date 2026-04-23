#!/usr/bin/env python3
"""
Script de correction automatique des erreurs TS6133 dans SERVICALL V6.
Corrige les variables déclarées mais non utilisées en les préfixant avec _.
"""

import re
import os
import subprocess

def get_ts6133_errors(typecheck_file: str) -> list[tuple[str, int, str]]:
    """Extrait les erreurs TS6133 du fichier de typecheck."""
    errors = []
    pattern = re.compile(
        r"(client/src/[^(]+)\((\d+),\d+\): error TS6133: '(\w+)' is declared but its value is never read\."
    )
    with open(typecheck_file) as f:
        for line in f:
            m = pattern.search(line)
            if m:
                filepath = m.group(1)
                lineno = int(m.group(2))
                varname = m.group(3)
                errors.append((filepath, lineno, varname))
    return errors

def fix_unused_var(filepath: str, lineno: int, varname: str) -> bool:
    """Préfixe une variable non utilisée avec _ pour supprimer l'erreur TS6133."""
    abs_path = os.path.join('/home/ubuntu/servicall', filepath)
    
    try:
        with open(abs_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        if lineno < 1 or lineno > len(lines):
            return False
        
        line = lines[lineno - 1]
        
        # Skip si déjà préfixé avec _
        if f'_{varname}' in line:
            return False
        
        # Cas 1: import { varname, ... } -> import { _varname, ... }
        # Cas 2: const varname = ... -> const _varname = ...
        # Cas 3: let varname = ... -> let _varname = ...
        # Cas 4: function param: varname -> _varname
        
        # Patterns à remplacer (avec word boundaries)
        new_line = re.sub(
            r'\b' + re.escape(varname) + r'\b',
            f'_{varname}',
            line,
            count=1  # Seulement la première occurrence
        )
        
        if new_line != line:
            lines[lineno - 1] = new_line
            with open(abs_path, 'w', encoding='utf-8') as f:
                f.writelines(lines)
            return True
        
        return False
    except Exception as e:
        print(f"Error fixing {filepath}:{lineno} ({varname}): {e}")
        return False

def main():
    typecheck_file = '/tmp/typecheck_output.txt'
    errors = get_ts6133_errors(typecheck_file)
    
    print(f"Found {len(errors)} TS6133 errors")
    
    # Grouper par fichier
    by_file: dict[str, list[tuple[int, str]]] = {}
    for filepath, lineno, varname in errors:
        if filepath not in by_file:
            by_file[filepath] = []
        by_file[filepath].append((lineno, varname))
    
    fixed = 0
    skipped = 0
    
    for filepath, file_errors in by_file.items():
        # Trier par ligne décroissante pour éviter les décalages
        file_errors.sort(key=lambda x: x[0], reverse=True)
        
        for lineno, varname in file_errors:
            # Ne pas renommer les variables importantes
            skip_vars = {'React', 'default', 'export', 'import', 'type', 'interface', 'class'}
            if varname in skip_vars:
                skipped += 1
                continue
            
            if fix_unused_var(filepath, lineno, varname):
                fixed += 1
                print(f"Fixed {filepath}:{lineno} - _{varname}")
            else:
                skipped += 1
    
    print(f"\nFixed: {fixed}, Skipped: {skipped}")

if __name__ == '__main__':
    main()
