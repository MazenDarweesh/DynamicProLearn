$connStr = "Data Source=localhost;Initial Catalog=DynamicProLearnDb;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()

Write-Output "--- Lessons ---"
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT Id, Title FROM Lessons WHERE Id = '556ef8ee-695c-4c2f-900b-36ef1ed98bd8'"
$r = $cmd.ExecuteReader()
while ($r.Read()) {
    Write-Output ($r[0].ToString() + " | " + $r[1].ToString())
}
$r.Close()

Write-Output "--- StudentQuizProgresses ---"
$cmd.CommandText = "SELECT Id, UserId, LessonId, ScorePercentage, IsCompleted, Answers FROM StudentQuizProgresses"
$r = $cmd.ExecuteReader()
while ($r.Read()) {
    Write-Output ($r[0].ToString() + " | " + $r[1].ToString() + " | " + $r[2].ToString() + " | " + $r[3].ToString() + " | " + $r[4].ToString())
    Write-Output ("Answers: " + $r[5].ToString())
}
$r.Close()

$conn.Close()
