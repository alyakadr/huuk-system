$filePath = "src\pages\staff\ManagerAppointmentManagement.js"
$content = Get-Content $filePath -Raw
$content = $content -replace '=\\u003e', '=>'
$content = $content -replace '\\u003c', '<'
$content = $content -replace '\\u003e', '>'
$content = $content -replace '\\u0026\\u0026', '&&'
Set-Content $filePath $content
Write-Host "Fixed encoding issues in $filePath"
