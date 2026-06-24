import os
import re

target_dir = 'public/pages'
pattern = re.compile(
    r'\s*<div[^>]*>\s*'
    r'<button[^>]*id="btnListView".*?</button>\s*'
    r'<button[^>]*id="btnGridView".*?</button>\s*'
    r'</div>',
    re.DOTALL
)

for filename in os.listdir(target_dir):
    if not filename.endswith('.html'): continue
    filepath = os.path.join(target_dir, filename)
    with open(filepath, 'r') as f: content = f.read()
    new_content, num = pattern.subn('', content)
    if num > 0:
        with open(filepath, 'w') as f: f.write(new_content)
        print(f"Removed from {filename}")
