using System;
using System.Collections.Generic;

namespace LearnDynamicPro.Application.Dtos.Internal;

public class UserPermissionsDto
{
    public string UserId { get; set; } = string.Empty;
    public List<AccessibleModuleDto> AccessibleModules { get; set; } = new List<AccessibleModuleDto>();
    public List<string> AccessibleUnitIds { get; set; } = new List<string>();
    public List<string> AccessibleLessonIds { get; set; } = new List<string>();
}

public class AccessibleModuleDto
{
    public string ModuleId { get; set; } = string.Empty;
    public List<string> LevelFilters { get; set; } = new List<string>();
    public List<string> TypeFilters { get; set; } = new List<string>();
}
