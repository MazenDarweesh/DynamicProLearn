namespace LearnDynamicPro.Application.Common;

public class Result<T>
{
    public bool IsSuccess { get; }
    public T? Value { get; }
    public string Error { get; }

    protected Result(bool isSuccess, T? value, string error)
    {
        if (isSuccess && !string.IsNullOrEmpty(error))
            throw new InvalidOperationException();
        if (!isSuccess && string.IsNullOrEmpty(error))
            throw new InvalidOperationException();

        IsSuccess = isSuccess;
        Value = value;
        Error = error;
    }

    public static Result<T> Success(T value) => new Result<T>(true, value, string.Empty);
    public static Result<T> Failure(string error) => new Result<T>(false, default, error);
}

public class Result
{
    public bool IsSuccess { get; }
    public string Error { get; }

    protected Result(bool isSuccess, string error)
    {
        if (isSuccess && !string.IsNullOrEmpty(error))
            throw new InvalidOperationException();
        if (!isSuccess && string.IsNullOrEmpty(error))
            throw new InvalidOperationException();

        IsSuccess = isSuccess;
        Error = error;
    }

    public static Result Success() => new Result(true, string.Empty);
    public static Result Failure(string error) => new Result(false, error);
}
