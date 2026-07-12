namespace LearnDynamicPro.Application.Interfaces.Repositories;

public interface IUnitOfWork : IDisposable
{
    // A generic way to get a repository for any entity
    IGenericRepository<TEntity> Repository<TEntity>() where TEntity : class;
    
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
