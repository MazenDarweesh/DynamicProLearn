namespace LearnDynamicPro.Application.Dtos.Student;

public class LastAccessedLessonDto
{
    public Guid LessonId { get; set; }
    public Guid ModuleId { get; set; }
    public string LessonTitle { get; set; } = string.Empty;
}
