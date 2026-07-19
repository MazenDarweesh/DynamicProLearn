using System;
using System.Collections.Generic;

namespace LearnDynamicPro.Application.Dtos.Progress;

public class ModuleAnalyticsDto
{
    public Guid ModuleId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<UnitAnalyticsDto> Units { get; set; } = new();
}

public class UnitAnalyticsDto
{
    public Guid UnitId { get; set; }
    public string Title { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
    public List<LessonAnalyticsDto> Lessons { get; set; } = new();
}

public class LessonAnalyticsDto
{
    public Guid LessonId { get; set; }
    public string Title { get; set; } = string.Empty;
    public Guid LevelId { get; set; }
    public string LevelLabel { get; set; } = string.Empty;
    public Guid TypeId { get; set; }
    public string TypeLabel { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
    
    // Analytics
    public int EnrolledStudentsCount { get; set; }
    public int CompletedStudentsCount { get; set; }
}

public class LessonDetailsAnalyticsDto
{
    public Guid LessonId { get; set; }
    public string LessonTitle { get; set; } = string.Empty;
    public string ModuleName { get; set; } = string.Empty;
    public string UnitName { get; set; } = string.Empty;

    // Summary Stats
    public int TotalCompanies { get; set; }
    public int TotalDepartments { get; set; }
    public int TotalEnrolledStudents { get; set; }
    public int TotalCompletedStudents { get; set; }

    // Tree
    public List<CompanyLessonAnalyticsDto> Companies { get; set; } = new();
}

public class CompanyLessonAnalyticsDto
{
    public Guid CompanyId { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public bool IsFullyCompleted { get; set; }
    public List<DepartmentLessonAnalyticsDto> Departments { get; set; } = new();
}

public class DepartmentLessonAnalyticsDto
{
    public Guid DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
    public bool IsFullyCompleted { get; set; }
    public List<UserLessonAnalyticsDto> Users { get; set; } = new();
}

public class UserLessonAnalyticsDto
{
    public Guid UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public bool IsCompleted { get; set; }
}
