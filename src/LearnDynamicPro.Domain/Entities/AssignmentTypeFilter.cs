using LearnDynamicPro.Domain.Common;

namespace LearnDynamicPro.Domain.Entities;

public class AssignmentTypeFilter : BaseEntity
{
    public Guid AssignmentId { get; set; }
    public Guid TypeId { get; set; }

    public DepartmentModuleAssignment? Assignment { get; set; }
    public TypeOption? Type { get; set; }
}
