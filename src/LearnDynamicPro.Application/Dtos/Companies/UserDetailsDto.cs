namespace LearnDynamicPro.Application.Dtos.Companies;

public class UserDetailsDto
{
    public Guid UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public Guid DepartmentId { get; set; }
    public int TotalAssignedLessons { get; set; }
    public int TotalCompletedLessons { get; set; }
    public List<UserModuleProgressDto> Modules { get; set; } = new();
}

public class UserModuleProgressDto
{
    public Guid ModuleId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int TotalLessons { get; set; }
    public int CompletedLessons { get; set; }
    public List<UserUnitProgressDto> Units { get; set; } = new();
}

public class UserUnitProgressDto
{
    public Guid UnitId { get; set; }
    public string Name { get; set; } = string.Empty;
    public List<UserLessonProgressDto> Lessons { get; set; } = new();
}

public class UserLessonProgressDto
{
    public Guid LessonId { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsCompleted { get; set; }
}
