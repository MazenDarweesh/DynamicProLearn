using System.Linq.Expressions;

namespace LearnDynamicPro.Application.Interfaces.Repositories;

public interface IGenericRepository<T> where T : class
{
    Task<T?> GetByIdAsync(Guid id);
    Task<IEnumerable<T>> GetAllAsync();
    Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate);
    
    // Support for AsQueryable if projection is needed, though returning IQueryable from repo is a leaky abstraction,
    // it's sometimes practical for .Select() projections in services before execution.
    IQueryable<T> Query(Expression<Func<T, bool>>? predicate = null);
    
    Task AddAsync(T entity);
    Task AddRangeAsync(IEnumerable<T> entities);
    
    void Update(T entity);
    void UpdateRange(IEnumerable<T> entities);
    
    void Remove(T entity);
    void RemoveRange(IEnumerable<T> entities);
    
    Task<bool> AnyAsync(Expression<Func<T, bool>> predicate);
}
