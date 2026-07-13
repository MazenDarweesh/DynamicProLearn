using System;
using System.Collections.Generic;

namespace LearnDynamicPro.Application.Dtos.Tester;

public class TestCycleDto
{
    public Guid Id { get; set; }
    public Guid VersionId { get; set; }
    public string VersionLabel { get; set; } = string.Empty;
    public Guid TesterId { get; set; }
    public string TesterName { get; set; } = string.Empty;
    public int AssignedModulesCount { get; set; }
    public List<Guid> ModuleIds { get; set; } = new();
}

public class CreateTestCycleRequest
{
    public string VersionLabel { get; set; } = string.Empty;
    public Guid TesterId { get; set; }
}

public class AssignModulesToTestCycleRequest
{
    public List<Guid> ModuleIds { get; set; } = new();
}
