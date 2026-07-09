using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Domain.Entities;
using LearnDynamicPro.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace LearnDynamicPro.Infrastructure.Persistence;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        // Ensure database is created/migrated
        if (context.Database.IsSqlServer())
        {
            await context.Database.MigrateAsync();
        }

        // 1. Seed Company & Department
        if (!await context.Companies.AnyAsync())
        {
            var defaultCompany = new Company { Name = "Dynamic Pro Inc." };
            context.Companies.Add(defaultCompany);
            await context.SaveChangesAsync();

            var defaultDepartment = new Department 
            { 
                Name = "IT Administration", 
                CompanyId = defaultCompany.Id 
            };
            context.Departments.Add(defaultDepartment);
            await context.SaveChangesAsync();

            // 2. Seed Admin User
            var adminUser = new User
            {
                Username = "admin",
                PasswordHash = passwordHasher.Hash("Admin@123"),
                Role = UserRole.Admin,
                CompanyId = defaultCompany.Id,
                DepartmentId = defaultDepartment.Id
            };
            context.Users.Add(adminUser);
            await context.SaveChangesAsync();
            
            // We use the adminUser.Id as the creator for lookups
            var adminId = adminUser.Id;

            // 3. Seed LevelOptions
            if (!await context.LevelOptions.AnyAsync())
            {
                context.LevelOptions.AddRange(
                    new LevelOption { Label = "Beginner", SortOrder = 1, CreatedByAdminId = adminId },
                    new LevelOption { Label = "Intermediate", SortOrder = 2, CreatedByAdminId = adminId },
                    new LevelOption { Label = "Advanced", SortOrder = 3, CreatedByAdminId = adminId }
                );
            }

            // 4. Seed TypeOptions
            if (!await context.TypeOptions.AnyAsync())
            {
                context.TypeOptions.AddRange(
                    new TypeOption { Label = "Video Lecture", CreatedByAdminId = adminId },
                    new TypeOption { Label = "Interactive Quiz", CreatedByAdminId = adminId },
                    new TypeOption { Label = "Practical Assignment", CreatedByAdminId = adminId }
                );
            }

            // 5. Seed FeedbackConditionOptions
            if (await context.FeedbackConditionOptions.AnyAsync())
            {
                context.FeedbackConditionOptions.RemoveRange(context.FeedbackConditionOptions);
                await context.SaveChangesAsync();
            }
            if (!await context.FeedbackConditionOptions.AnyAsync())
            {
                context.FeedbackConditionOptions.AddRange(
                    new FeedbackConditionOption { Label = "🟩 يعمل بكفاءة تامة (نجاح)", IsActive = true, CreatedByAdminId = adminId },
                    new FeedbackConditionOption { Label = "🟨 خلل في واجهة المستخدم / عدم محاذاة", IsActive = true, CreatedByAdminId = adminId },
                    new FeedbackConditionOption { Label = "🟥 خطأ في النظام / خطأ حسابي", IsActive = true, CreatedByAdminId = adminId },
                    new FeedbackConditionOption { Label = "☠️ تعطل الصفحة / توقف كامل (Blocker)", IsActive = true, CreatedByAdminId = adminId },
                    new FeedbackConditionOption { Label = "⚙️ يحتاج تدخل فريق البرمجة الأساسي", IsActive = true, CreatedByAdminId = adminId }
                );
            }

            await context.SaveChangesAsync();
        }
    }
}
