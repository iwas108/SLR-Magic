import os

start_dir = r"c:\Users\Aditya Suranata\Downloads\github\SLR-Magic"
ignored = ['node_modules', '.next', '.git', 'venv']

found = []
for root, dirs, files in os.walk(start_dir):
    # modify dirs in place to prune ignored directories
    dirs[:] = [d for d in dirs if d not in ignored]
    for file in files:
        if file.endswith('.slr') or file.endswith('.csv'):
            found.append(os.path.join(root, file))

for f in found:
    print(f)
