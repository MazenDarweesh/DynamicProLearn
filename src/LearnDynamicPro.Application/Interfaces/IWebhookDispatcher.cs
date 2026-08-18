using System;
using System.Threading.Tasks;

namespace LearnDynamicPro.Application.Interfaces;

public interface IWebhookDispatcher
{
    Task DispatchLessonUpdatedAsync(Guid lessonId);
    Task DispatchLessonDeletedAsync(Guid lessonId);
}
