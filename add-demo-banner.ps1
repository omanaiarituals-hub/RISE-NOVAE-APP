# add-demo-banner.ps1
# Lance ce script depuis la racine de ton projet :
# .\add-demo-banner.ps1

$pages = @(
    "src\app\program\page.tsx",
    "src\app\planner\page.tsx",
    "src\app\routines\page.tsx",
    "src\app\agent\page.tsx",
    "src\app\tracker\page.tsx",
    "src\app\recipes\page.tsx",
    "src\app\family\page.tsx",
    "src\app\notes\page.tsx"
)

$importLine = "import { DemoBanner } from '@/components/DemoBanner'"

foreach ($page in $pages) {
    if (-not (Test-Path $page)) {
        Write-Host "SKIP (non trouve) : $page" -ForegroundColor Yellow
        continue
    }

    $content = Get-Content $page -Raw -Encoding UTF8

    # 1. Ajoute l'import si pas deja present
    if ($content -notmatch "DemoBanner") {
        # Insere apres la derniere ligne d'import
        $content = $content -replace "((?:import[^\n]+\n)+)", "`$1$importLine`n"
        Write-Host "Import ajoute : $page" -ForegroundColor Cyan
    } else {
        Write-Host "Import deja present : $page" -ForegroundColor Gray
    }

    # 2. Entoure le return principal avec <> <DemoBanner /> </>
    # Cherche : return (\r?\n\s*)(<div ) ou return (\r?\n\s*)(<>)
    # et ne modifie que si DemoBanner n'est pas deja dans le return
    if ($content -notmatch "<DemoBanner") {
        # Pattern : "return (" suivi de saut de ligne puis "<div" ou "<main" ou "<section"
        $pattern = '(return \(\s*\r?\n\s*)(<(?:div|main|section|article|nav|header|aside))'
        $replacement = '$1<>' + "`n    <DemoBanner />`n    " + '$2'
        $newContent = $content -replace $pattern, $replacement

        # Ferme le fragment : trouve la derniere ligne ") \n}" et ajoute </> avant
        $newContent = $newContent -replace '(\n\s*\)\s*\n\}(\s*)$)', "`n  </>`n)`n}`$2"

        if ($newContent -ne $content) {
            $newContent | Set-Content $page -Encoding UTF8 -NoNewline
            Write-Host "DemoBanner ajoute : $page" -ForegroundColor Green
        } else {
            Write-Host "Pattern return non trouve, modification manuelle requise : $page" -ForegroundColor Red
        }
    } else {
        Write-Host "DemoBanner deja present : $page" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Termine ! Lance : git add . && git commit -m 'feat: DemoBanner sur toutes les pages' && git push" -ForegroundColor White