using LearnDynamicPro.Domain.Common;

namespace LearnDynamicPro.Domain.Entities;

public class AssignmentLevelFilter : BaseEntity
{
    public Guid AssignmentId { get; set; }
    public Guid LevelId { get; set; }

    public DepartmentModuleAssignment? Assignment { get; set; }
    public LevelOption? Level { get; set; }
}
