$ErrorActionPreference = "Stop"

try {
    Write-Host "1. Logging in as student (user: a)..."
    $passwords = @("123", "123456", "12345678", "Password123!", "Admin123!", "a", "P@ssword1")
    $token = $null

    foreach ($pwd in $passwords) {
        try {
            $loginBody = @{ username = "a"; password = $pwd } | ConvertTo-Json
            $loginRes = Invoke-RestMethod -Uri "http://localhost:5115/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
            $token = $loginRes.token
            if ($token) {
                Write-Host "SUCCESS: Logged in with password: $pwd"
                break
            }
        } catch {
        }
    }

    if (-not $token) {
        Write-Host "FAIL: No token returned."
        exit 1
    }
    Write-Host "SUCCESS: Logged in. Token received."

    Write-Host "2. Requesting GET /api/student/copilot-filters..."
    $headers = @{
        "Authorization" = "Bearer $token"
    }

    $filterRes = Invoke-RestMethod -Uri "http://localhost:5115/api/student/copilot-filters" -Method Get -Headers $headers

    Write-Host "SUCCESS: HTTP 200 OK"
    Write-Host "=== FILTER HIERARCHY DTO DUMP ==="
    Write-Host ("Modules count: " + $filterRes.modules.Count)
    foreach ($m in $filterRes.modules) {
        Write-Host ("  [Module] Title: " + $m.title + " | Id: " + $m.id + " | Units: " + $m.units.Count)
        foreach ($u in $m.units) {
            Write-Host ("    [Unit] Title: " + $u.title + " | Id: " + $u.id + " | Lessons: " + $u.lessons.Count)
            foreach ($l in $u.lessons) {
                Write-Host ("      [Lesson] Title: " + $l.title + " | Id: " + $l.id + " | LevelId: " + $l.levelId + " | TypeId: " + $l.typeId)
            }
        }
    }

    Write-Host ("`nLevels count: " + $filterRes.levels.Count)
    foreach ($lvl in $filterRes.levels) {
        Write-Host ("  [Level] Name: " + $lvl.name + " | SortOrder: " + $lvl.sortOrder + " | Id: " + $lvl.id)
    }

    Write-Host ("`nTypes count: " + $filterRes.types.Count)
    foreach ($t in $filterRes.types) {
        Write-Host ("  [Type] Name: " + $t.name + " | Id: " + $t.id)
    }

} catch {
    Write-Host "ERROR: $_"
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "Response body: " ($reader.ReadToEnd())
    }
}
