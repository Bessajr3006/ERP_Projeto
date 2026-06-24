import os
import re

target_dir = 'public/pages'
pattern = re.compile(
    r'\s*<div class="flex items-center bg-white dark:bg-slate-800 p-1 rounded-full border border-gray-200 dark:border-slate-700 shadow-sm">\s*'
    r'<button type="button" id="btnListView".*?</button>\s*'
    r'<button type="button" id="btnGridView".*?</button>\s*'
    r'</div>',
    re.DOTALL
)

count = 0
for filename in os.listdir(target_dir):
    if not filename.endswith('.html'):
        continue
    filepath = os.path.join(target_dir, filename)
    with open(filepath, 'r') as f:
        content = f.read()
    
    new_content, num_subs = pattern.subn('', content)
    
    if num_subs > 0:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Removed from {filename}")
        count += 1

print(f"Total files updated: {count}")
