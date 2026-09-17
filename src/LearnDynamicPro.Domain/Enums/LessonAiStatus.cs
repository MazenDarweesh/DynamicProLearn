namespace LearnDynamicPro.Domain.Enums;

public enum LessonAiStatus
{
    None = 0,        // لا يوجد فيديو أو لم تبدأ المعالجة
    Queued = 1,      // في طابور الانتظار لبدء المعالجة
    Processing = 2,  // قيد التحميل والتفريغ الصوتي والتضمين في Qdrant
    Completed = 3,   // اكتملت المعالجة والمحتوى جاهز لتوليد الكويز والملخص
    Failed = 4       // فشلت المعالجة ويتاح زر إعادة المحاولة
}
