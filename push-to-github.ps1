# PowerShell script to push project to GitHub
# Run this after installing Git and creating a GitHub repository

$repoUrl = Read-Host "Enter your GitHub repository URL (e.g., https://github.com/username/recipe-system-react.git)"

Write-Host "Initializing Git repository..."
git init

Write-Host "Adding files..."
git add .

Write-Host "Committing..."
git commit -m "Initial commit"

Write-Host "Setting main branch..."
git branch -M main

Write-Host "Adding remote origin..."
git remote add origin $repoUrl

Write-Host "Pushing to GitHub..."
git push -u origin main

Write-Host "Done!"
