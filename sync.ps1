# Script de sincronização contínua com GitHub / Lovable
Write-Host "Iniciando monitoramento de alterações (checagem a cada 15s)..." -ForegroundColor Cyan
Write-Host "Pressione Ctrl+C para encerrar o monitoramento a qualquer momento.`n" -ForegroundColor Yellow

while ($true) {
    $status = git status --porcelain
    if ($status) {
        git add .
        $data = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        git commit -m "auto-sync: $data"
        git push origin main
        Write-Host "[$data] Alterações enviadas com sucesso para o GitHub & Lovable!" -ForegroundColor Green
    }
    Start-Sleep -Seconds 15
}
