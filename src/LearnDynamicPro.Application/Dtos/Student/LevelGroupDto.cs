using LearnDynamicPro.Application.Dtos.Modules;

namespace LearnDynamicPro.Application.Dtos.Student;

public class LevelGroupDto
{
    public Guid LevelId { get; set; }
    public string LevelLabel { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public int TotalLessons { get; set; }
    public int Completed { get; set; }
    public List<LessonDto> Lessons { get; set; } = new List<LessonDto>();
}
