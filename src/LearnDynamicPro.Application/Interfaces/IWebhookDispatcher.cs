using System;
using System.Threading.Tasks;

namespace LearnDynamicPro.Application.Interfaces;

public interface IWebhookDispatcher
{
    Task DispatchLessonUpdatedAsync(Guid lessonId, string? videoUrl = null, Guid? moduleId = null, Guid? unitId = null);
    Task DispatchLessonReferencedAsync(Guid lessonId, string videoUrl, Guid? moduleId = null, Guid? unitId = null);
    Task DispatchLessonDeletedAsync(Guid lessonId);
}
