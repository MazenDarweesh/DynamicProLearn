using System;
using System.Collections.Generic;

namespace LearnDynamicPro.Application.Dtos.Companies;

public class DepartmentDetailsDto
{
    public Guid DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
    public int TotalUsers { get; set; }
    public List<DepartmentModuleProgressDto> Modules { get; set; } = new();
}

public class DepartmentModuleProgressDto
{
    public Guid ModuleId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int CompletedLessons { get; set; }
    public int TotalLessons { get; set; }
    public List<DepartmentUnitProgressDto> Units { get; set; } = new();
}

public class DepartmentUnitProgressDto
{
    public Guid UnitId { get; set; }
    public string Name { get; set; } = string.Empty;
    public List<DepartmentLessonProgressDto> Lessons { get; set; } = new();
}

public class DepartmentLessonProgressDto
{
    public Guid LessonId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int CompletedUsersCount { get; set; }
    public int TotalUsersCount { get; set; }
    public bool IsFullyCompletedByAll => TotalUsersCount > 0 && CompletedUsersCount == TotalUsersCount;
}
