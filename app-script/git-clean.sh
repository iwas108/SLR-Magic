git checkout main
git branch | grep -v "main" | xargs git branch -D
git fetch --all --prune