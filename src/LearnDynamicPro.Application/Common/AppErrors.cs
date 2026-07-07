namespace LearnDynamicPro.Application.Common;

public static class AppErrors
{
    public static class Authentication
    {
        public const string InvalidCredentials = "Invalid username or password.";
        public const string UserNotFound = "User not found.";
    }

    public static class Authorization
    {
        public const string AccessDenied = "You do not have permission to access this resource.";
        public const string DepartmentAccessDenied = "Department does not have access to this module.";
    }

    public static class General
    {
        public const string NotFound = "The requested resource was not found.";
        public const string InternalServerError = "An unexpected error occurred. Please try again later.";
        public const string ValidationFailed = "One or more validation errors occurred.";
    }

    public static class Tester
    {
        public const string NoActiveVersion = "No active ERP version set for this tester.";
    }
}
