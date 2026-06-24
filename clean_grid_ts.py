import os
import re

target_dir = 'public/ts'
pattern_renderGrid = re.compile(r'\s*renderGrid:\s*(?:\([^)]*\)|[a-zA-Z_0-9]+)\s*=>\s*\{.*?\}(?=\s*,|\s*\n\s*[a-zA-Z_0-9]+:)', re.DOTALL)
pattern_renderGrid_short = re.compile(r'\s*renderGrid:\s*(?:\([^)]*\)|[a-zA-Z_0-9]+)\s*=>\s*renderGrid\([^)]*\),?', re.DOTALL)
pattern_gridSectionId = re.compile(r'\s*gridSectionId:\s*\'[^\']*\',?', re.MULTILINE)

for root, _, files in os.walk(target_dir):
    for filename in files:
        if not filename.endswith('.ts'): continue
        filepath = os.path.join(root, filename)
        with open(filepath, 'r') as f: content = f.read()
        
        orig_content = content
        # Replace renderGrid block with renderGrid: null,
        # It's safer to just inject a check!
        
        # Actually, let's just make getById return a dummy object if not found? No.
        
