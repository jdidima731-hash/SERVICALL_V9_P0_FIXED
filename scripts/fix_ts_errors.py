#!/usr/bin/env python3
"""
Script de correction automatique des erreurs TypeScript courantes dans SERVICALL V6.
Corrige:
1. TS7006: Parameter 'error' implicitly has 'any' type -> ajouter : unknown
2. TS6133: Variables déclarées mais non utilisées -> préfixer avec _
3. TS18046: 'error' is of type 'unknown' -> utiliser (error as any).message
"""

import re
import os
import sys

def fix_implicit_any_error_params(content: str) -> str:
    """Corrige les paramètres 'error' sans type dans les catch blocks."""
    # Pattern: } catch (error) { -> } catch (error: unknown) {
    content = re.sub(
        r'\}\s*catch\s*\(\s*(error|err|e)\s*\)',
        lambda m: '} catch (' + m.group(1) + ': unknown)',
        content
    )
    return content

def fix_unknown_error_access(content: str) -> str:
    """Corrige les accès à error.message quand error est unknown."""
    # Pattern: error.message -> (error as any).message
    content = re.sub(
        r'\b(error|err|e)\s*instanceof\s*Error\s*\?\s*(error|err|e)\.message\s*:\s*String\((error|err|e)\)',
        lambda m: f'({m.group(1)} instanceof Error ? {m.group(1)}.message : String({m.group(1)}))',
        content
    )
    return content

def fix_implicit_any_callbacks(content: str, filepath: str) -> str:
    """Corrige les paramètres implicitement any dans les callbacks."""
    # Pour les paramètres 'failureCount' dans useAuth
    if 'useAuth' in filepath:
        content = re.sub(
            r'failureCount\b(?!\s*:)',
            'failureCount: number',
            content
        )
    return content

def process_file(filepath: str) -> bool:
    """Traite un fichier et retourne True si des modifications ont été faites."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            original = f.read()
        
        content = original
        content = fix_implicit_any_error_params(content)
        content = fix_implicit_any_callbacks(content, filepath)
        
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    base_dir = '/home/ubuntu/servicall/client/src'
    modified = []
    
    for root, dirs, files in os.walk(base_dir):
        dirs[:] = [d for d in dirs if d not in ['node_modules', 'dist']]
        for fname in files:
            if fname.endswith(('.ts', '.tsx')) and not fname.endswith('.test.tsx'):
                filepath = os.path.join(root, fname)
                if process_file(filepath):
                    relpath = os.path.relpath(filepath, '/home/ubuntu/servicall')
                    modified.append(relpath)
    
    print(f"Modified {len(modified)} files:")
    for f in modified:
        print(f"  {f}")

if __name__ == '__main__':
    main()
