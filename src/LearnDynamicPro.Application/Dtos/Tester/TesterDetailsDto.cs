using System;
using System.Collections.Generic;

namespace LearnDynamicPro.Application.DTOs.Tester
{
    public class TesterDetailsDto
    {
        public string Id { get; set; } = null!;
        public string Name { get; set; } = null!;
        public string Email { get; set; } = null!;
        public int TotalAssignedLessons { get; set; }
        public int CompletedLessons { get; set; }
        public int ProgressPercent { get; set; }
        
        public List<TesterLessonFeedbackDto> Feedbacks { get; set; } = new();
    }

    public class TesterLessonFeedbackDto
    {
        public string VersionName { get; set; } = null!;
        public string ModuleName { get; set; } = null!;
        public string UnitName { get; set; } = null!;
        public string LessonName { get; set; } = null!;
        public string Status { get; set; } = null!; // e.g. "مكتمل", "بها أخطاء", "غير مكتمل"
        public string? Comment { get; set; }
        public DateTime? EvaluationDate { get; set; }
    }
}
