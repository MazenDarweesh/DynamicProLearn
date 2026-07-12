using System;

namespace LearnDynamicPro.Application.Dtos.Progress;

public class ProgressResult
{
    public int Completed { get; set; }
    public int Total { get; set; }
    public double Percentage => Total == 0 ? 0 : Math.Round((double)Completed / Total * 100, 1);
}
